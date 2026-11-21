import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createFileItem,
  createItem,
  deleteItem,
  setItemContent,
  setItemFavorite,
  setItemPinned,
  updateItem,
} from "@/lib/db/item-writes";
import type { CreateFileItemData, CreateItemData, UpdateItemData } from "@/lib/item-schemas";
import { tryDeleteOrphanedTags } from "@/lib/db/tags";
import { prisma } from "@/lib/prisma";
import { getItemPreview } from "@/lib/search";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    itemType: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db/tags", () => ({ tryDeleteOrphanedTags: vi.fn() }));
// getItemFile reads the current user, mocked per test; the other queries tested
// here use neither module, and mocking them keeps the session out of the test.
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ getAvailableTypes: vi.fn(), getItemTypeBySlug: vi.fn() }));
// The list queries wait for a request so they stay out of the build-time prerender.
vi.mock("next/server", () => ({ connection: vi.fn() }));

const ITEM_ID = "cmtg169y00002zzx5wxanksok";

const data: UpdateItemData = {
  title: "useDebounce hook",
  description: "Delays a changing value",
  content: "export function useDebounce() {}",
  language: "typescript",
  url: "https://example.com",
  tags: ["react", "hooks"],
  collectionIds: ["col-1", "col-2"],
};

const savedRow = {
  id: ITEM_ID,
  title: "useDebounce hook",
  description: "Delays a changing value",
  contentType: "text",
  content: "export function useDebounce() {}",
  url: null,
  language: "typescript",
  isPinned: true,
  isFavorite: false,
  createdAt: new Date("2026-08-30T10:00:00.000Z"),
  updatedAt: new Date("2026-11-10T12:30:00.000Z"),
  itemType: { name: "snippet" },
  tags: [{ name: "hooks" }, { name: "react" }],
  collections: [{ collection: { id: "col-1", name: "React Patterns" } }],
};

const replacedTags = {
  set: [],
  connectOrCreate: [
    { where: { name: "react" }, create: { name: "react" } },
    { where: { name: "hooks" }, create: { name: "hooks" } },
  ],
};

/**
 * The memberships an edit writes: rows for collections no longer chosen go,
 * rows for the chosen ones are added unless they already exist, so a kept
 * membership keeps its date.
 */
const replacedCollections = {
  deleteMany: { collectionId: { notIn: ["col-1", "col-2"] } },
  createMany: {
    data: [{ collectionId: "col-1" }, { collectionId: "col-2" }],
    skipDuplicates: true,
  },
};

function ownItemOfType(name: string) {
  vi.mocked(prisma.item.findFirst).mockResolvedValue({
    itemType: { name },
    tags: [{ id: "tag-old" }, { id: "tag-kept" }],
  } as never);
}

/** The `data` argument of the one update call. */
function writtenData() {
  return vi.mocked(prisma.item.update).mock.calls[0][0].data;
}

describe("updateItem", () => {
  beforeEach(() => {
    vi.mocked(prisma.item.update).mockResolvedValue(savedRow as never);
  });

  it("reports not-found without writing when the item isn't the user's", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, "user-1", data)).toEqual({ status: "not-found" });
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      select: { itemType: { select: { name: true } }, tags: { select: { id: true } } },
    });
    expect(prisma.item.update).not.toHaveBeenCalled();
    expect(tryDeleteOrphanedTags).not.toHaveBeenCalled();
  });

  it("offers the item's previous tags for removal once the edit has saved", async () => {
    ownItemOfType("snippet");

    await updateItem(ITEM_ID, "user-1", data);

    expect(tryDeleteOrphanedTags).toHaveBeenCalledWith(["tag-old", "tag-kept"]);
    expect(vi.mocked(prisma.item.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(tryDeleteOrphanedTags).mock.invocationCallOrder[0],
    );
  });

  it("scopes the write itself to the owner as well", async () => {
    ownItemOfType("snippet");

    await updateItem(ITEM_ID, "user-1", data);

    expect(vi.mocked(prisma.item.update).mock.calls[0][0].where).toEqual({
      id: ITEM_ID,
      userId: "user-1",
    });
  });

  it("writes a snippet's content and language but not a URL, and replaces its tags", async () => {
    ownItemOfType("snippet");

    await updateItem(ITEM_ID, "user-1", data);

    expect(writtenData()).toEqual({
      title: data.title,
      description: data.description,
      content: data.content,
      language: data.language,
      preview: getItemPreview({ content: data.content, url: null, fileName: null }),
      tags: replacedTags,
      collections: replacedCollections,
    });
  });

  it("writes a prompt's content but not a language", async () => {
    ownItemOfType("prompt");

    await updateItem(ITEM_ID, "user-1", data);

    expect(writtenData()).toEqual({
      title: data.title,
      description: data.description,
      content: data.content,
      preview: getItemPreview({ content: data.content, url: null, fileName: null }),
      tags: replacedTags,
      collections: replacedCollections,
    });
  });

  it("writes a link's URL but not content or a language", async () => {
    ownItemOfType("link");

    await updateItem(ITEM_ID, "user-1", data);

    expect(writtenData()).toEqual({
      title: data.title,
      description: data.description,
      url: data.url,
      preview: data.url,
      tags: replacedTags,
      collections: replacedCollections,
    });
  });

  it("writes only the shared fields for a type with none of its own", async () => {
    ownItemOfType("image");

    await updateItem(ITEM_ID, "user-1", data);

    expect(writtenData()).toEqual({
      title: data.title,
      description: data.description,
      tags: replacedTags,
      collections: replacedCollections,
    });
  });

  it("clears every tag when none are given", async () => {
    ownItemOfType("note");

    await updateItem(ITEM_ID, "user-1", { ...data, tags: [] });

    expect(writtenData()?.tags).toEqual({ set: [], connectOrCreate: [] });
  });

  it("refuses to clear a link's URL, without writing", async () => {
    ownItemOfType("link");

    expect(await updateItem(ITEM_ID, "user-1", { ...data, url: null })).toEqual({
      status: "url-required",
    });
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("saves a type that doesn't need a URL without one", async () => {
    ownItemOfType("snippet");

    expect(await updateItem(ITEM_ID, "user-1", { ...data, url: null })).toMatchObject({
      status: "saved",
    });
  });

  it("returns the saved item as the drawer shows it", async () => {
    ownItemOfType("snippet");

    expect(await updateItem(ITEM_ID, "user-1", data)).toEqual({
      status: "saved",
      item: {
        id: ITEM_ID,
        title: "useDebounce hook",
        description: "Delays a changing value",
        contentType: "text",
        content: "export function useDebounce() {}",
        url: null,
        language: "typescript",
        isPinned: true,
        isFavorite: false,
        typeName: "snippet",
        tags: ["hooks", "react"],
        collections: [{ id: "col-1", name: "React Patterns" }],
        createdAt: "2026-08-30T10:00:00.000Z",
        updatedAt: "2026-11-10T12:30:00.000Z",
      },
    });
  });

  it("reports not-found when the item is deleted between the lookup and the write", async () => {
    ownItemOfType("snippet");
    vi.mocked(prisma.item.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
        code: "P2025",
        clientVersion: "7.10.0",
      }),
    );

    expect(await updateItem(ITEM_ID, "user-1", data)).toEqual({ status: "not-found" });
  });

  it("rethrows any other database error", async () => {
    ownItemOfType("snippet");
    vi.mocked(prisma.item.update).mockRejectedValue(new Error("connection reset"));

    await expect(updateItem(ITEM_ID, "user-1", data)).rejects.toThrow("connection reset");
  });
});

describe("deleteItem", () => {
  it("deletes only when the item is the user's, in one scoped statement", async () => {
    vi.mocked(prisma.item.delete).mockResolvedValue({ fileUrl: null, tags: [] } as never);

    await expect(deleteItem(ITEM_ID, "user-1")).resolves.toEqual({ fileKey: null });
    expect(prisma.item.delete).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      select: { fileUrl: true, tags: { select: { id: true } } },
    });
    expect(prisma.item.findFirst).not.toHaveBeenCalled();
  });

  it("offers the deleted item's tags for removal", async () => {
    vi.mocked(prisma.item.delete).mockResolvedValue({
      fileUrl: null,
      tags: [{ id: "tag-1" }, { id: "tag-2" }],
    } as never);

    await deleteItem(ITEM_ID, "user-1");

    expect(tryDeleteOrphanedTags).toHaveBeenCalledWith(["tag-1", "tag-2"]);
  });

  it("returns the stored file's key, so the caller can remove it from R2", async () => {
    vi.mocked(prisma.item.delete).mockResolvedValue({ fileUrl: "user-1/abc-notes.md", tags: [] } as never);

    await expect(deleteItem(ITEM_ID, "user-1")).resolves.toEqual({ fileKey: "user-1/abc-notes.md" });
  });

  it("returns null when nothing matched: someone else's item or a missing one", async () => {
    vi.mocked(prisma.item.delete).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("No record was found for a delete.", {
        code: "P2025",
        clientVersion: "7.0.0",
      }),
    );

    await expect(deleteItem(ITEM_ID, "user-2")).resolves.toBeNull();
  });

  it("lets any other database error through", async () => {
    vi.mocked(prisma.item.delete).mockRejectedValue(new Error("connection reset"));

    await expect(deleteItem(ITEM_ID, "user-1")).rejects.toThrow("connection reset");
  });
});

describe("createItem", () => {
  const TYPE_ID = "type-snippet";
  const createData: CreateItemData = { ...data, typeName: "snippet" };

  /** The `data` argument of the one create call. */
  function createdData() {
    return vi.mocked(prisma.item.create).mock.calls[0][0].data;
  }

  const newTags = {
    connectOrCreate: [
      { where: { name: "react" }, create: { name: "react" } },
      { where: { name: "hooks" }, create: { name: "hooks" } },
    ],
  };

  beforeEach(() => {
    vi.mocked(prisma.itemType.findFirst).mockResolvedValue({ id: TYPE_ID } as never);
    vi.mocked(prisma.item.create).mockResolvedValue({ ...savedRow, collections: [] } as never);
  });

  it("looks the type up among the system types only", async () => {
    await createItem("user-1", createData);

    expect(prisma.itemType.findFirst).toHaveBeenCalledWith({
      where: { name: "snippet", isSystem: true, userId: null },
      select: { id: true },
    });
  });

  it("returns null without writing when the system type is missing", async () => {
    vi.mocked(prisma.itemType.findFirst).mockResolvedValue(null);

    expect(await createItem("user-1", createData)).toBeNull();
    expect(prisma.item.create).not.toHaveBeenCalled();
  });

  it("creates a snippet for the user with its content and language but no URL", async () => {
    await createItem("user-1", createData);

    expect(createdData()).toEqual({
      title: data.title,
      description: data.description,
      contentType: "text",
      content: data.content,
      language: data.language,
      url: null,
      preview: getItemPreview({ content: data.content, url: null, fileName: null }),
      user: { connect: { id: "user-1" } },
      itemType: { connect: { id: TYPE_ID } },
      tags: newTags,
      collections: { create: [{ collectionId: "col-1" }, { collectionId: "col-2" }] },
    });
  });

  it("drops a language from a note", async () => {
    await createItem("user-1", { ...createData, typeName: "note" });

    expect(createdData()).toMatchObject({ contentType: "text", content: data.content, language: null, url: null });
  });

  it("stores a link as a url payload with no content or language", async () => {
    await createItem("user-1", { ...createData, typeName: "link" });

    expect(createdData()).toMatchObject({
      contentType: "url",
      content: null,
      language: null,
      url: data.url,
    });
  });

  it("returns the new item as the drawer shows it", async () => {
    expect(await createItem("user-1", createData)).toMatchObject({
      id: ITEM_ID,
      typeName: "snippet",
      tags: ["hooks", "react"],
      collections: [],
      createdAt: "2026-08-30T10:00:00.000Z",
    });
  });
});

describe("createFileItem", () => {
  const TYPE_ID = "type-image";
  const fileData: CreateFileItemData = {
    title: "Architecture diagram",
    description: null,
    tags: ["docs"],
    collectionIds: ["col-1"],
    typeName: "image",
    folderId: null,
  };
  const upload = { key: "user-1/8f14e45f-diagram.png", fileName: "diagram.png", fileSize: 6302 };
  const fileRow = {
    ...savedRow,
    contentType: "file",
    content: null,
    language: null,
    fileName: "diagram.png",
    fileSize: 6302,
    itemType: { name: "image" },
    tags: [{ name: "docs" }],
    collections: [],
  };

  beforeEach(() => {
    vi.mocked(prisma.itemType.findFirst).mockResolvedValue({ id: TYPE_ID } as never);
    vi.mocked(prisma.item.create).mockResolvedValue(fileRow as never);
  });

  it("looks the type up among the system types only", async () => {
    await createFileItem("user-1", fileData, upload);

    expect(prisma.itemType.findFirst).toHaveBeenCalledWith({
      where: { name: "image", isSystem: true, userId: null },
      select: { id: true },
    });
  });

  it("stores a file payload pointing at the upload, with no text fields", async () => {
    await createFileItem("user-1", fileData, upload);

    expect(vi.mocked(prisma.item.create).mock.calls[0][0].data).toEqual({
      title: "Architecture diagram",
      description: null,
      contentType: "file",
      fileUrl: "user-1/8f14e45f-diagram.png",
      fileName: "diagram.png",
      fileSize: 6302,
      // A file's preview is its name.
      preview: "diagram.png",
      user: { connect: { id: "user-1" } },
      itemType: { connect: { id: TYPE_ID } },
      tags: { connectOrCreate: [{ where: { name: "docs" }, create: { name: "docs" } }] },
      collections: { create: [{ collectionId: "col-1" }] },
    });
  });

  it("puts a file uploaded inside a folder into that folder", async () => {
    const FOLDER_ID = "cmtg169y00003zzx5folder01";
    await createFileItem("user-1", { ...fileData, typeName: "file", folderId: FOLDER_ID }, upload);

    expect(vi.mocked(prisma.item.create).mock.calls[0][0].data).toMatchObject({
      folder: { connect: { id: FOLDER_ID } },
    });
  });

  it("returns the item as the drawer shows it, without the storage key", async () => {
    const item = await createFileItem("user-1", fileData, upload);

    expect(item).toMatchObject({ typeName: "image", fileName: "diagram.png", fileSize: 6302 });
    expect(item).not.toHaveProperty("fileUrl");
  });

  it("returns null without writing when the system type is missing", async () => {
    vi.mocked(prisma.itemType.findFirst).mockResolvedValue(null);

    expect(await createFileItem("user-1", fileData, upload)).toBeNull();
    expect(prisma.item.create).not.toHaveBeenCalled();
  });
});

describe("setItemFavorite", () => {
  it("updates only the favorite flag, scoped to the user, in one statement", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue({ id: ITEM_ID } as never);

    expect(await setItemFavorite("user-1", ITEM_ID, true)).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      data: { isFavorite: true },
      select: { id: true },
    });
  });

  it("returns false when there is no such item for the user", async () => {
    vi.mocked(prisma.item.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7",
      }),
    );

    expect(await setItemFavorite("user-1", ITEM_ID, false)).toBe(false);
  });

  it("rethrows other database errors", async () => {
    vi.mocked(prisma.item.update).mockRejectedValue(new Error("connection lost"));

    await expect(setItemFavorite("user-1", ITEM_ID, true)).rejects.toThrow("connection lost");
  });
});

describe("setItemPinned", () => {
  it("updates only the pinned flag, scoped to the user, in one statement", async () => {
    vi.mocked(prisma.item.update).mockResolvedValue({ id: ITEM_ID } as never);

    expect(await setItemPinned("user-1", ITEM_ID, true)).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      data: { isPinned: true },
      select: { id: true },
    });
  });

  it("returns false when there is no such item for the user", async () => {
    vi.mocked(prisma.item.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7",
      }),
    );

    expect(await setItemPinned("user-1", ITEM_ID, false)).toBe(false);
  });

  it("rethrows other database errors", async () => {
    vi.mocked(prisma.item.update).mockRejectedValue(new Error("connection lost"));

    await expect(setItemPinned("user-1", ITEM_ID, true)).rejects.toThrow("connection lost");
  });
});


describe("setItemContent", () => {
  const UPDATED = new Date("2026-11-21T12:00:00.000Z");

  it("writes only the content and its preview, scoped to the user", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({ itemType: { name: "prompt" } } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({ content: "  New prompt  ", updatedAt: UPDATED } as never);

    expect(await setItemContent("user-1", ITEM_ID, "  New prompt  ")).toEqual({
      content: "  New prompt  ",
      updatedAt: UPDATED,
    });
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      select: { itemType: { select: { name: true } } },
    });
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      data: {
        content: "  New prompt  ",
        preview: getItemPreview({ content: "  New prompt  ", url: null, fileName: null }),
      },
      select: { content: true, updatedAt: true },
    });
  });

  it.each(["link", "file", "image"])("refuses a %s, which has no content, without writing", async (name) => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({ itemType: { name } } as never);

    expect(await setItemContent("user-1", ITEM_ID, "text")).toBeNull();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("returns null for someone else's item or a missing one, without writing", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    expect(await setItemContent("user-1", ITEM_ID, "text")).toBeNull();
    expect(prisma.item.update).not.toHaveBeenCalled();
  });

  it("returns null when the item is deleted between the lookup and the write", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({ itemType: { name: "note" } } as never);
    vi.mocked(prisma.item.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "7" }),
    );

    expect(await setItemContent("user-1", ITEM_ID, "text")).toBeNull();
  });

  it("rethrows other database errors", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({ itemType: { name: "prompt" } } as never);
    vi.mocked(prisma.item.update).mockRejectedValue(new Error("connection lost"));

    await expect(setItemContent("user-1", ITEM_ID, "text")).rejects.toThrow("connection lost");
  });
});
