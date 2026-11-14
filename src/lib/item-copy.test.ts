import { afterEach, describe, expect, it, vi } from "vitest";

import { CopyTextError } from "@/lib/clipboard";
import { fetchItemCopyText, getItemCopyText } from "@/lib/item-copy";
import type { ItemDetail } from "@/types/items";

const ITEM_ID = "cmabc123def456ghi789jkl0";

function detail(overrides: Partial<ItemDetail>): ItemDetail {
  return {
    id: ITEM_ID,
    title: "useAuth hook",
    description: null,
    contentType: "text",
    content: "export function useAuth() {}",
    url: null,
    language: "typescript",
    fileName: null,
    fileSize: null,
    isPinned: false,
    isFavorite: false,
    typeName: "snippet",
    tags: [],
    collections: [],
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
    ...overrides,
  };
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function expectCopyError(promise: Promise<string>, message: string) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(CopyTextError);
  expect((error as Error).message).toBe(message);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getItemCopyText", () => {
  it("returns a text item's content", () => {
    expect(getItemCopyText(detail({}))).toBe("export function useAuth() {}");
  });

  it("returns a link's URL rather than its content", () => {
    const link = detail({ contentType: "url", url: "https://nextjs.org", content: "ignored" });

    expect(getItemCopyText(link)).toBe("https://nextjs.org");
  });

  it("returns null for a file item", () => {
    expect(getItemCopyText(detail({ contentType: "file", content: null }))).toBeNull();
  });
});

describe("fetchItemCopyText", () => {
  it("loads the item without caching and returns its copy text", async () => {
    const fetchMock = stubFetch(200, { success: true, data: detail({}), error: null });

    await expect(fetchItemCopyText(ITEM_ID)).resolves.toBe("export function useAuth() {}");
    expect(fetchMock).toHaveBeenCalledWith(`/api/items/${ITEM_ID}`, { cache: "no-store" });
  });

  it("passes the route's error through, e.g. a missing item", async () => {
    stubFetch(404, { success: false, data: null, error: "Item not found." });

    await expectCopyError(fetchItemCopyText(ITEM_ID), "Item not found.");
  });

  it("falls back to generic copy when the error reply has no message", async () => {
    stubFetch(500, { success: false, data: null });

    await expectCopyError(fetchItemCopyText(ITEM_ID), "Couldn't load this item. Please try again.");
  });

  it("reports a network failure as a load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expectCopyError(fetchItemCopyText(ITEM_ID), "Couldn't load this item. Please try again.");
  });

  it("reports a reply that isn't JSON as a load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 502 })));

    await expectCopyError(fetchItemCopyText(ITEM_ID), "Couldn't load this item. Please try again.");
  });

  it("refuses an item with nothing to copy", async () => {
    stubFetch(200, { success: true, data: detail({ content: null }), error: null });

    await expectCopyError(fetchItemCopyText(ITEM_ID), "This item has nothing to copy.");
  });
});
