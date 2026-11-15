import { afterEach, describe, expect, it, vi } from "vitest";

import { ITEM_LOAD_FAILED } from "@/lib/action-result";
import { fetchItemDetail } from "@/lib/item-request";

const ITEM_ID = "cmabc123def456ghi789jkl0";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response | Promise<never>) {
  const fetchMock = vi.fn().mockReturnValue(
    response instanceof Response ? Promise.resolve(response) : response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchItemDetail", () => {
  it("returns the item, fetched past the HTTP cache with the caller's signal", async () => {
    const item = { id: ITEM_ID, title: "useAuth hook" };
    const fetchMock = stubFetch(json(200, { success: true, data: item, error: null }));
    const { signal } = new AbortController();

    expect(await fetchItemDetail(ITEM_ID, { signal })).toEqual({ ok: true, item });
    expect(fetchMock).toHaveBeenCalledWith(`/api/items/${ITEM_ID}`, { cache: "no-store", signal });
  });

  it("encodes the id into the path", async () => {
    const fetchMock = stubFetch(json(404, { success: false, data: null, error: "Not found" }));

    await fetchItemDetail("a/b?c");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/items/a%2Fb%3Fc");
  });

  it("passes on the route's own error message", async () => {
    stubFetch(json(401, { success: false, data: null, error: "Your session has expired. Sign in again." }));

    expect(await fetchItemDetail(ITEM_ID)).toEqual({
      ok: false,
      message: "Your session has expired. Sign in again.",
    });
  });

  it("falls back to a generic message for an error reply without one", async () => {
    stubFetch(json(500, { success: false, data: null }));

    expect(await fetchItemDetail(ITEM_ID)).toEqual({ ok: false, message: ITEM_LOAD_FAILED });
  });

  it("returns the generic message for a reply that isn't JSON", async () => {
    stubFetch(new Response("<html>Bad gateway</html>", { status: 502 }));

    expect(await fetchItemDetail(ITEM_ID)).toEqual({ ok: false, message: ITEM_LOAD_FAILED });
  });

  it("returns the generic message instead of throwing when the request fails", async () => {
    stubFetch(Promise.reject(new TypeError("Failed to fetch")));

    expect(await fetchItemDetail(ITEM_ID)).toEqual({ ok: false, message: ITEM_LOAD_FAILED });
  });
});
