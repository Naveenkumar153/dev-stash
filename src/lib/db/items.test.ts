import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCollectionItems,
  getFavoriteItems,
  getFileListPage,
  getItemForAi,
  getItemFile,
  getItemsByType,
  getStoredBytes,
} from "@/lib/db/items";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
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
      aggregate: vi.fn(),
      groupBy: vi.fn(),
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

describe("getItemForAi", () => {
  it("reads the item's type, title, language and content, scoped to the user", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      title: "Prune Docker",
      content: "docker system prune",
      language: "bash",
      itemType: { name: "command" },
    } as never);

    expect(await getItemForAi("user-1", ITEM_ID)).toEqual({
      typeName: "command",
      title: "Prune Docker",
      language: "bash",
      content: "docker system prune",
    });
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1" },
      select: { title: true, content: true, language: true, itemType: { select: { name: true } } },
    });
  });

  it("reads missing content as blank", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      title: "Empty",
      content: null,
      language: null,
      itemType: { name: "snippet" },
    } as never);

    expect(await getItemForAi("user-1", ITEM_ID)).toMatchObject({ content: "", language: null });
  });

  it("returns null for someone else's item or a missing one", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
    expect(await getItemForAi("user-1", ITEM_ID)).toBeNull();
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

describe("getFileListPage", () => {
  const fileType = { id: "type-file", name: "file" };
  const now = new Date("2026-11-20T15:00:00.000Z");
  const noFilters = { type: "all", date: "any" } as const;
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

  beforeEach(() => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getItemTypeBySlug).mockResolvedValue(fileType as never);
    vi.mocked(prisma.item.findMany).mockResolvedValue([row] as never);
    vi.mocked(prisma.item.groupBy).mockResolvedValue([
      { folderId: null, _count: { _all: 4 } },
      { folderId: "folder-1", _count: { _all: 2 } },
      { folderId: "folder-2", _count: { _all: 1 } },
    ] as never);
  });

  it("loads only the open folder's files, with the row fields, named by their type", async () => {
    const page = await getFileListPage({ folderId: "folder-1", filters: noFilters, now });

    expect(page).toEqual({
      typeName: "file",
      items: [{ ...row, typeName: "file" }],
      total: 7,
      folderCounts: { "folder-1": 2, "folder-2": 1 },
    });
    expect(getItemTypeBySlug).toHaveBeenCalledWith("files");
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", itemTypeId: "type-file", folderId: "folder-1" },
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

  it("loads the top level's files for no open folder", async () => {
    await getFileListPage({ folderId: null, filters: noFilters, now });

    expect(vi.mocked(prisma.item.findMany).mock.calls[0][0]?.where).toEqual({
      userId: "user-1",
      itemTypeId: "type-file",
      folderId: null,
    });
  });

  it("counts every folder's files in one grouped query over the user's files", async () => {
    await getFileListPage({ folderId: null, filters: noFilters, now });

    expect(prisma.item.groupBy).toHaveBeenCalledWith({
      by: ["folderId"],
      where: { userId: "user-1", itemTypeId: "type-file" },
      _count: { _all: true },
    });
  });

  it("with a filter on, matches across every folder in the database, by extension and date", async () => {
    await getFileListPage({ folderId: "folder-1", filters: { type: "data", date: "7d" }, now });

    expect(vi.mocked(prisma.item.findMany).mock.calls[0][0]?.where).toEqual({
      userId: "user-1",
      itemTypeId: "type-file",
      // Seven whole UTC days, today included.
      createdAt: { gte: new Date("2026-11-14T00:00:00.000Z") },
      OR: [
        { fileName: { endsWith: ".json", mode: "insensitive" } },
        { fileName: { endsWith: ".xml", mode: "insensitive" } },
      ],
    });
  });

  it("filters by type alone without a date bound", async () => {
    await getFileListPage({ folderId: null, filters: { type: "pdf", date: "any" }, now });

    expect(vi.mocked(prisma.item.findMany).mock.calls[0][0]?.where).toEqual({
      userId: "user-1",
      itemTypeId: "type-file",
      OR: [{ fileName: { endsWith: ".pdf", mode: "insensitive" } }],
    });
  });

  it("lists nothing, without a query, when there's no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getFileListPage({ folderId: null, filters: noFilters, now })).toEqual({
      typeName: "file",
      items: [],
      total: 0,
      folderCounts: {},
    });
    expect(prisma.item.findMany).not.toHaveBeenCalled();
    expect(prisma.item.groupBy).not.toHaveBeenCalled();
  });

  it("returns null when the file type isn't in the database, so the page can 404", async () => {
    vi.mocked(getItemTypeBySlug).mockResolvedValue(null);

    expect(await getFileListPage({ folderId: null, filters: noFilters, now })).toBeNull();
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

  it("loads only the requested page of the type, pinned first then newest, with the type's total", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([cardRow] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(43);

    const list = await getItemsByType("snippets", 3);

    const where = { userId: "user-1", itemTypeId: "type-snippet" };
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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

  it("loads only the requested page of the collection's items, pinned first then newest, with the total", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([cardRow] as never);
    vi.mocked(prisma.item.count).mockResolvedValue(22);

    const { rows, total } = await getCollectionItems(COLLECTION_ID, 2);

    const where = { userId: "user-1", collections: { some: { collectionId: COLLECTION_ID } } };
    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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

describe("getStoredBytes", () => {
  it("sums the user's stored file sizes", async () => {
    vi.mocked(prisma.item.aggregate).mockResolvedValue({ _sum: { fileSize: 6302 } } as never);

    expect(await getStoredBytes("user-1")).toBe(6302);
    expect(prisma.item.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-1", fileSize: { not: null } },
      _sum: { fileSize: true },
    });
  });

  it("is 0 for a user with no files", async () => {
    vi.mocked(prisma.item.aggregate).mockResolvedValue({ _sum: { fileSize: null } } as never);

    expect(await getStoredBytes("user-1")).toBe(0);
  });
});
