import { describe, expect, it, vi } from "vitest";

import { getSearchItems } from "@/lib/db/search-items";
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

describe("getSearchItems", () => {
  it("reads the stored previews, newest first and capped, never the payloads", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: ITEM_ID,
        title: "useDebounce hook",
        isPinned: true,
        isFavorite: false,
        preview: "export function useDebounce() { return value; }",
        itemType: { name: "snippet" },
      },
      {
        id: "cmtg169y00004zzx5wxanksok",
        title: "Lucide icons",
        isPinned: false,
        isFavorite: true,
        preview: "https://lucide.dev/icons",
        itemType: { name: "link" },
      },
    ] as never);

    const items = await getSearchItems();

    expect(prisma.item.findMany).toHaveBeenCalledOnce();
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2000,
      select: {
        id: true,
        title: true,
        isPinned: true,
        isFavorite: true,
        preview: true,
        itemType: { select: { name: true } },
      },
    });
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

  it("cuts previews for rows saved before the column, in one extra query", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue("user-1");
    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce([
        { id: ITEM_ID, title: "Old snippet", isPinned: false, isFavorite: false, preview: null, itemType: { name: "snippet" } },
        { id: "cmtg169y00004zzx5wxanksok", title: "New", isPinned: false, isFavorite: false, preview: "kept", itemType: { name: "note" } },
      ] as never)
      .mockResolvedValueOnce([
        { id: ITEM_ID, content: "line one\n  line two", url: null, fileName: null },
      ] as never);

    const items = await getSearchItems();

    expect(prisma.item.findMany).toHaveBeenLastCalledWith({
      where: { id: { in: [ITEM_ID] } },
      select: { id: true, content: true, url: true, fileName: true },
    });
    expect(items.map((item) => item.preview)).toEqual(["line one line two", "kept"]);
  });

  it("lists nothing, without a query, when there is no current user", async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null);

    expect(await getSearchItems()).toEqual([]);
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});

