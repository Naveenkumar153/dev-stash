import { afterEach, describe, expect, it, vi } from "vitest";

import { SEARCH_LOAD_FAILED } from "@/lib/action-result";
import { fetchSearchData, SEARCH_URL } from "@/lib/search-request";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(result: Promise<Response>) {
  const fetchMock = vi.fn().mockReturnValue(result);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("fetchSearchData", () => {
  it("returns the data, fetched past the HTTP cache with the caller's signal", async () => {
    const data = {
      items: [
        { id: "item-1", title: "useDebounce hook", typeName: "snippet", isPinned: false, isFavorite: false, preview: null },
      ],
      collections: [{ id: "col-1", name: "React Patterns", itemCount: 3, dominantTypeName: "snippet" }],
    };
    const fetchMock = stubFetch(json(200, { success: true, data, error: null }));
    const signal = new AbortController().signal;

    expect(await fetchSearchData({ signal })).toEqual({ ok: true, data });
    expect(fetchMock).toHaveBeenCalledWith(SEARCH_URL, { cache: "no-store", signal });
  });

  it("returns the route's own message for an error reply", async () => {
    stubFetch(json(401, { success: false, data: null, error: "Your session has expired. Sign in again." }));

    expect(await fetchSearchData()).toEqual({
      ok: false,
      message: "Your session has expired. Sign in again.",
    });
  });

  it("falls back to a generic message for a JSON error reply without a message", async () => {
    stubFetch(json(500, { message: "Internal Server Error" }));

    expect(await fetchSearchData()).toEqual({ ok: false, message: SEARCH_LOAD_FAILED });
  });

  it("falls back to a generic message for a reply that isn't JSON", async () => {
    stubFetch(Promise.resolve(new Response("<html>Bad gateway</html>", { status: 502 })));

    expect(await fetchSearchData()).toEqual({ ok: false, message: SEARCH_LOAD_FAILED });
  });

  it("returns a generic message instead of throwing when the request fails", async () => {
    stubFetch(Promise.reject(new TypeError("Failed to fetch")));

    expect(await fetchSearchData()).toEqual({ ok: false, message: SEARCH_LOAD_FAILED });
  });
});
