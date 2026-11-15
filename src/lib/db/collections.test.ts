import { describe, expect, it, vi } from "vitest";

import { createCollection, getCollectionOptions, ownsCollections } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: { collection: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() } },
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
