import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createFileItem,
  createItem,
  deleteItem,
  getCollectionItems,
  getFavoriteItems,
  getFileListItems,
  getItemFile,
  getItemsByType,
  getSearchItems,
  setItemFavorite,
  updateItem,
} from "@/lib/db/items";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import type { CreateFileItemData, CreateItemData, UpdateItemData } from "@/lib/item-schemas";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    itemType: { findFirst: vi.fn() },
  },
}));
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
  vi.mocked(prisma.item.findFirst).mockResolvedValue({ itemType: { name } } as never);
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
      select: { itemType: { select: { name: true } } },
    });
    expect(prisma.item.update).not.toHaveBeenCalled();
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
    vi.mocked(prisma.item.delete).mockResolvedValue({ fileUrl: null } as never);

    await expect(deleteItem(ITEM_ID, "user-1")).resolves.toEqual({ fileKey: null });
    expect(prisma.item.delete).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      select: { fileUrl: true },
    });
    expect(prisma.item.findFirst).not.toHaveBeenCalled();
  });

  it("returns the stored file's key, so the caller can remove it from R2", async () => {
    vi.mocked(prisma.item.delete).mockResolvedValue({ fileUrl: "user-1/abc-notes.md" } as never);

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

describe("getItemFile", () => {
  it("finds a file item's storage key, scoped to the current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      fileUrl: "user-1/8f14e45f-diagram.png",
      fileName: "diagram.png",
    } as never);

    expect(await getItemFile(ITEM_ID)).toEqual({
      key: "user-1/8f14e45f-diagram.png",
      fileName: "diagram.png",
    });
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1", contentType: "file" },
      select: { fileUrl: true, fileName: true },
    });
  });

  it("returns null without a query when there's no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getItemFile(ITEM_ID)).toBeNull();
    expect(prisma.item.findFirst).not.toHaveBeenCalled();
  });

  it("returns null for someone else's item, a missing one, or one without a file", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");

    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
    expect(await getItemFile(ITEM_ID)).toBeNull();

    vi.mocked(prisma.item.findFirst).mockResolvedValue({ fileUrl: null, fileName: "x.png" } as never);
    expect(await getItemFile(ITEM_ID)).toBeNull();

    vi.mocked(prisma.item.findFirst).mockResolvedValue({ fileUrl: "user-1/k", fileName: null } as never);
    expect(await getItemFile(ITEM_ID)).toBeNull();
  });
});

describe("getFileListItems", () => {
  const fileType = { id: "type-file", name: "file" };

  it("lists the current user's files with the row fields only, named by their type", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getItemTypeBySlug).mockResolvedValue(fileType as never);
    const row = {
      id: ITEM_ID,
      title: "Release notes",
      isPinned: false,
      isFavorite: true,
      fileName: "notes.pdf",
      fileSize: 2048,
      folderId: "folder-1",
      createdAt: new Date("2026-11-01T00:00:00.000Z"),
    };
    vi.mocked(prisma.item.findMany).mockResolvedValue([row] as never);

    expect(await getFileListItems()).toEqual({
      typeName: "file",
      items: [{ ...row, typeName: "file" }],
    });
    expect(getItemTypeBySlug).toHaveBeenCalledWith("files");
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", itemTypeId: "type-file" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        isPinned: true,
        isFavorite: true,
        fileName: true,
        fileSize: true,
        folderId: true,
        createdAt: true,
      },
    });
  });

  it("lists nothing, without a query, when there's no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);
    vi.mocked(getItemTypeBySlug).mockResolvedValue(fileType as never);

    expect(await getFileListItems()).toEqual({ typeName: "file", items: [] });
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });

  it("returns null when the file type isn't in the database, so the page can 404", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getItemTypeBySlug).mockResolvedValue(null);

    expect(await getFileListItems()).toBeNull();
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});

const cardRow = {
  id: ITEM_ID,
  title: "useDebounce hook",
  description: null,
  isPinned: false,
  isFavorite: false,
  fileName: null,
  createdAt: new Date("2026-11-01T00:00:00.000Z"),
  itemType: { name: "snippet" },
  tags: [{ name: "hooks" }, { name: "react" }],
};

describe("getItemsByType", () => {
  beforeEach(() => {
    vi.mocked(getItemTypeBySlug).mockResolvedValue({ id: "type-snippet", name: "snippet" } as never);
  });

  it("loads only the requested page of the type, newest first, with the type's total", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([cardRow] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(43);

    const list = await getItemsByType("snippets", 3);

    const where = { userId: "user-1", itemTypeId: "type-snippet" };
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 42,
        take: 21,
      }),
    );
    expect(prisma.item.count).toHaveBeenCalledWith({ where });
    expect(list).toEqual({
      typeName: "snippet",
      items: [expect.objectContaining({ id: ITEM_ID, typeName: "snippet", tags: ["hooks", "react"] })],
      total: 43,
    });
  });

  it("returns null, without a query, for an unknown type", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getItemTypeBySlug).mockResolvedValue(null);

    expect(await getItemsByType("widgets", 1)).toBeNull();
    expect(prisma.item.findMany).not.toHaveBeenCalled();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getItemsByType("snippets", 1)).toEqual({ typeName: "snippet", items: [], total: 0 });
    expect(prisma.item.findMany).not.toHaveBeenCalled();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });
});

describe("getCollectionItems", () => {
  const COLLECTION_ID = "cmtg169y00003zzx5wxanksok";

  it("loads only the requested page of the collection's items, newest first, with the total", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([cardRow] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(22);

    const { rows, total } = await getCollectionItems(COLLECTION_ID, 2);

    const where = { userId: "user-1", collections: { some: { collectionId: COLLECTION_ID } } };
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 21,
        take: 21,
      }),
    );
    expect(prisma.item.count).toHaveBeenCalledWith({ where });
    expect(total).toBe(22);
    expect(rows).toEqual([
      expect.objectContaining({ id: ITEM_ID, typeName: "snippet", tags: ["hooks", "react"] }),
    ]);
    expect(rows[0]).not.toHaveProperty("itemType");
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getCollectionItems(COLLECTION_ID, 1)).toEqual({ rows: [], total: 0 });
    expect(prisma.item.findMany).not.toHaveBeenCalled();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });
});

describe("getSearchItems", () => {
  it("lists the current user's items newest first, each with a preview instead of its payload", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: ITEM_ID,
        title: "useDebounce hook",
        isPinned: true,
        isFavorite: false,
        content: "export function useDebounce() {\n  return value;\n}",
        url: null,
        fileName: null,
        itemType: { name: "snippet" },
      },
      {
        id: "cmtg169y00004zzx5wxanksok",
        title: "Lucide icons",
        isPinned: false,
        isFavorite: true,
        content: null,
        url: "https://lucide.dev/icons",
        fileName: null,
        itemType: { name: "link" },
      },
    ] as never);

    const items = await getSearchItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(items).toEqual([
      {
        id: ITEM_ID,
        title: "useDebounce hook",
        typeName: "snippet",
        isPinned: true,
        isFavorite: false,
        preview: "export function useDebounce() { return value; }",
      },
      {
        id: "cmtg169y00004zzx5wxanksok",
        title: "Lucide icons",
        typeName: "link",
        isPinned: false,
        isFavorite: true,
        preview: "https://lucide.dev/icons",
      },
    ]);
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getSearchItems()).toEqual([]);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});

describe("getFavoriteItems", () => {
  it("lists only the current user's favorites, most recently updated first, uncapped", async () => {
    const updatedAt = new Date("2026-11-15T14:00:00.000Z");
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: ITEM_ID,
        title: "useDebounce hook",
        isPinned: false,
        isFavorite: true,
        updatedAt,
        itemType: { name: "snippet" },
      },
    ] as never);

    const items = await getFavoriteItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", isFavorite: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        isPinned: true,
        isFavorite: true,
        updatedAt: true,
        itemType: { select: { name: true } },
      },
    });
    expect(items).toEqual([
      {
        id: ITEM_ID,
        title: "useDebounce hook",
        typeName: "snippet",
        isPinned: false,
        isFavorite: true,
        updatedAt,
      },
    ]);
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getFavoriteItems()).toEqual([]);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
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
