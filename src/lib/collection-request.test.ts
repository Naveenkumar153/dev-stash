import { afterEach, describe, expect, it, vi } from "vitest";

import { COLLECTIONS_LOAD_FAILED } from "@/lib/action-result";
import { COLLECTIONS_URL, fetchCollectionOptions } from "@/lib/collection-request";

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

describe("fetchCollectionOptions", () => {
  it("returns the collections, fetched past the HTTP cache with the caller's signal", async () => {
    const collections = [{ id: "col-1", name: "React Patterns" }];
    const fetchMock = stubFetch(json(200, { success: true, data: collections, error: null }));
    const signal = new AbortController().signal;

    expect(await fetchCollectionOptions({ signal })).toEqual({ ok: true, collections });
    expect(fetchMock).toHaveBeenCalledWith(COLLECTIONS_URL, { cache: "no-store", signal });
  });

  it("returns the route's own message for an error reply", async () => {
    stubFetch(json(401, { success: false, data: null, error: "Your session has expired. Sign in again." }));

    expect(await fetchCollectionOptions()).toEqual({
      ok: false,
      message: "Your session has expired. Sign in again.",
    });
  });

  it("falls back to a generic message for a reply that isn't JSON", async () => {
    stubFetch(Promise.resolve(new Response("<html>Bad gateway</html>", { status: 502 })));

    expect(await fetchCollectionOptions()).toEqual({ ok: false, message: COLLECTIONS_LOAD_FAILED });
  });

  it("returns a generic message instead of throwing when the request fails", async () => {
    stubFetch(Promise.reject(new TypeError("Failed to fetch")));

    expect(await fetchCollectionOptions()).toEqual({ ok: false, message: COLLECTIONS_LOAD_FAILED });
  });
});
