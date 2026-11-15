import { describe, expect, it, vi } from "vitest";

import {
  createCollection,
  getCollection,
  getCollectionOptions,
  getCollections,
  getRecentCollections,
  ownsCollections,
} from "@/lib/db/collections";
import { getAvailableTypes } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    itemCollection: { groupBy: vi.fn() },
  },
}));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));
vi.mock("@/lib/db/item-types", () => ({ getAvailableTypes: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));

describe("createCollection", () => {
  it("creates the collection for the given user and returns it as an empty card", async () => {
    vi.mocked(prisma.collection.create).mockResolvedValue({
      id: "col-1",
      name: "React Patterns",
      description: null,
      isFavorite: false,
      _count: { items: 0 },
    } as never);

    const result = await createCollection("user-1", { name: "React Patterns", description: null });

    expect(prisma.collection.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: "React Patterns", description: null },
      select: {
        id: true,
        name: true,
        description: true,
        isFavorite: true,
        _count: { select: { items: true } },
      },
    });
    expect(result).toEqual({
      id: "col-1",
      name: "React Patterns",
      description: null,
      isFavorite: false,
      itemCount: 0,
      dominantTypeName: null,
      typeNames: [],
    });
  });
});

describe("getCollectionOptions", () => {
  it("lists only the user's collections, by name with a stable tie-break, ids and names only", async () => {
    vi.mocked(prisma.collection.findMany).mockResolvedValue([{ id: "col-1", name: "AI" }] as never);

    expect(await getCollectionOptions("user-1")).toEqual([{ id: "col-1", name: "AI" }]);
    expect(prisma.collection.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
  });
});

describe("ownsCollections", () => {
  it("counts the ids among the user's collections", async () => {
    vi.mocked(prisma.collection.count).mockResolvedValue(2);

    expect(await ownsCollections("user-1", ["col-1", "col-2"])).toBe(true);
    expect(prisma.collection.count).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["col-1", "col-2"] } },
    });
  });

  it("is false when any id is someone else's or missing", async () => {
    vi.mocked(prisma.collection.count).mockResolvedValue(1);

    expect(await ownsCollections("user-1", ["col-1", "col-2"])).toBe(false);
  });

  it("is true for no collections, without a query", async () => {
    expect(await ownsCollections("user-1", [])).toBe(true);
    expect(prisma.collection.count).not.toHaveBeenCalled();
  });
});

const COLLECTION_ID = "cmtg169y00002zzx5wxanksok";

describe("getCollections", () => {
  it("lists every one of the current user's collections, newest first, with no cap", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getAvailableTypes).mockResolvedValue([{ id: "type-snippet", name: "snippet" }] as never);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([
      { id: "col-1", name: "React", description: null, isFavorite: true, _count: { items: 2 } },
    ] as never);
    vi.mocked(prisma.itemCollection.groupBy).mockResolvedValue([
      { collectionId: "col-1", _count: { _all: 2 } },
    ] as never);

    const result = await getCollections();

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: undefined,
      }),
    );
    expect(result).toEqual([
      {
        id: "col-1",
        name: "React",
        description: null,
        isFavorite: true,
        itemCount: 2,
        dominantTypeName: "snippet",
        typeNames: ["snippet"],
      },
    ]);
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getCollections()).toEqual([]);
    expect(prisma.collection.findMany).not.toHaveBeenCalled();
  });

  it("leaves the dashboard's recent list capped", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getAvailableTypes).mockResolvedValue([]);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([]);

    await getRecentCollections();

    expect(prisma.collection.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
  });
});

describe("getCollection", () => {
  it("looks the collection up by id among the current user's only", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    const header = { id: COLLECTION_ID, name: "React", description: "Hooks", isFavorite: false };
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(header as never);

    expect(await getCollection(COLLECTION_ID)).toEqual(header);
    expect(prisma.collection.findFirst).toHaveBeenCalledWith({
      where: { id: COLLECTION_ID, userId: "user-1" },
      select: { id: true, name: true, description: true, isFavorite: true },
    });
  });

  it("returns null for a missing or another user's collection", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.collection.findFirst).mockResolvedValue(null);

    expect(await getCollection(COLLECTION_ID)).toBeNull();
  });

  it("returns null, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getCollection(COLLECTION_ID)).toBeNull();
    expect(prisma.collection.findFirst).not.toHaveBeenCalled();
  });
});
