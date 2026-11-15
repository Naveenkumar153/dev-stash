import { SEARCH_LOAD_FAILED } from "@/lib/action-result";
import type { SearchData, SearchDataResponse } from "@/types/search";

export const SEARCH_URL = "/api/search";

export type SearchDataResult = { ok: true; data: SearchData } | { ok: false; message: string };

/**
 * Loads the command palette's data from `GET /api/search`, bypassing the HTTP
 * cache so something created a moment ago is found. Never throws: a network
 * failure, an abort or a reply that isn't JSON comes back as a generic
 * message, and an error reply as the route's own.
 */
export async function fetchSearchData({
  signal,
}: { signal?: AbortSignal } = {}): Promise<SearchDataResult> {
  try {
    const response = await fetch(SEARCH_URL, { cache: "no-store", signal });
    const body = (await response.json()) as SearchDataResponse;

    return response.ok && body.data
      ? { ok: true, data: body.data }
      : { ok: false, message: body.error ?? SEARCH_LOAD_FAILED };
  } catch {
    return { ok: false, message: SEARCH_LOAD_FAILED };
  }
}
