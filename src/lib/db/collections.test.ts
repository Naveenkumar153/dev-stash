import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createCollection,
  deleteCollection,
  getCollection,
  getCollectionOptions,
  getCollectionPage,
  getCollections,
  getRecentCollections,
  ownsCollections,
  updateCollection,
} from "@/lib/db/collections";
import { getAvailableTypes } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    collection: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
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
  it("lists every one of the current user's collections, newest first, with no cap, for the palette", async () => {
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

describe("getCollectionPage", () => {
  it("loads only the requested page, newest first, with the user's total", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(getAvailableTypes).mockResolvedValue([]);
    vi.mocked(prisma.collection.findMany).mockResolvedValue([
      { id: "col-1", name: "React", description: null, isFavorite: false, _count: { items: 0 } },
    ] as never);
    vi.mocked(prisma.collection.count).mockResolvedValue(30);

    const { rows, total } = await getCollectionPage(2);

    expect(prisma.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: 21,
        take: 21,
      }),
    );
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(total).toBe(30);
    expect(rows).toEqual([expect.objectContaining({ id: "col-1", itemCount: 0 })]);
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getCollectionPage(1)).toEqual({ rows: [], total: 0 });
    expect(prisma.collection.findMany).not.toHaveBeenCalled();
    expect(prisma.collection.count).not.toHaveBeenCalled();
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

const notFound = () =>
  new Prisma.PrismaClientKnownRequestError("No record was found", {
    code: "P2025",
    clientVersion: "7",
  });

describe("updateCollection", () => {
  const data = { name: "Hooks", description: "Custom hooks" };

  it("writes the name and description in one statement scoped to the owner", async () => {
    const saved = { id: COLLECTION_ID, ...data, isFavorite: false };
    vi.mocked(prisma.collection.update).mockResolvedValue(saved as never);

    expect(await updateCollection("user-1", COLLECTION_ID, data)).toEqual(saved);
    expect(prisma.collection.update).toHaveBeenCalledWith({
      where: { id: COLLECTION_ID, userId: "user-1" },
      data,
      select: { id: true, name: true, description: true, isFavorite: true },
    });
  });

  it("returns null when nothing matched: someone else's collection or a missing one", async () => {
    vi.mocked(prisma.collection.update).mockRejectedValue(notFound());

    expect(await updateCollection("user-1", COLLECTION_ID, data)).toBeNull();
  });

  it("lets any other database error through", async () => {
    vi.mocked(prisma.collection.update).mockRejectedValue(new Error("connection lost"));

    await expect(updateCollection("user-1", COLLECTION_ID, data)).rejects.toThrow("connection lost");
  });
});

describe("deleteCollection", () => {
  it("deletes only the owner's collection, in one scoped statement, leaving items to the cascade", async () => {
    vi.mocked(prisma.collection.delete).mockResolvedValue({ id: COLLECTION_ID } as never);

    expect(await deleteCollection("user-1", COLLECTION_ID)).toBe(true);
    expect(prisma.collection.delete).toHaveBeenCalledWith({
      where: { id: COLLECTION_ID, userId: "user-1" },
      select: { id: true },
    });
  });

  it("returns false when nothing matched", async () => {
    vi.mocked(prisma.collection.delete).mockRejectedValue(notFound());

    expect(await deleteCollection("user-1", COLLECTION_ID)).toBe(false);
  });

  it("lets any other database error through", async () => {
    vi.mocked(prisma.collection.delete).mockRejectedValue(new Error("connection lost"));

    await expect(deleteCollection("user-1", COLLECTION_ID)).rejects.toThrow("connection lost");
  });
});
