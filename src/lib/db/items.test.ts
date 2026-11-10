import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { updateItem } from "@/lib/db/items";
import type { UpdateItemData } from "@/lib/item-schemas";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: { item: { findFirst: vi.fn(), update: vi.fn() } },
}));
// The module's other queries read the current user and the item types;
// updateItem uses neither, and mocking them keeps the session out of the test.
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ getAvailableTypes: vi.fn(), getItemTypeBySlug: vi.fn() }));

const ITEM_ID = "cmtg169y00002zzx5wxanksok";

const data: UpdateItemData = {
  title: "useDebounce hook",
  description: "Delays a changing value",
  content: "export function useDebounce() {}",
  language: "typescript",
  url: "https://example.com",
  tags: ["react", "hooks"],
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

  it("returns null without writing when the item isn't the user's", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, "user-1", data)).toBeNull();
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
    });
  });

  it("writes only the shared fields for a type with none of its own", async () => {
    ownItemOfType("image");

    await updateItem(ITEM_ID, "user-1", data);

    expect(writtenData()).toEqual({
      title: data.title,
      description: data.description,
      tags: replacedTags,
    });
  });

  it("clears every tag when none are given", async () => {
    ownItemOfType("note");

    await updateItem(ITEM_ID, "user-1", { ...data, tags: [] });

    expect(writtenData()?.tags).toEqual({ set: [], connectOrCreate: [] });
  });

  it("returns the saved item as the drawer shows it", async () => {
    ownItemOfType("snippet");

    expect(await updateItem(ITEM_ID, "user-1", data)).toEqual({
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
    });
  });

  it("returns null when the item is deleted between the lookup and the write", async () => {
    ownItemOfType("snippet");
    vi.mocked(prisma.item.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
        code: "P2025",
        clientVersion: "7.10.0",
      }),
    );

    expect(await updateItem(ITEM_ID, "user-1", data)).toBeNull();
  });

  it("rethrows any other database error", async () => {
    ownItemOfType("snippet");
    vi.mocked(prisma.item.update).mockRejectedValue(new Error("connection reset"));

    await expect(updateItem(ITEM_ID, "user-1", data)).rejects.toThrow("connection reset");
  });
});
