import { describe, expect, it, vi } from "vitest";

import { createCollection } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: { collection: { create: vi.fn() } } }));
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
