import { COLLECTIONS_LOAD_FAILED } from "@/lib/action-result";
import type { CollectionOption, CollectionOptionsResponse } from "@/types/collections";

export const COLLECTIONS_URL = "/api/collections";

export type CollectionOptionsResult =
  | { ok: true; collections: CollectionOption[] }
  | { ok: false; message: string };

/**
 * Loads the signed-in user's collections from `GET /api/collections`,
 * bypassing the HTTP cache so a collection created a moment ago is listed.
 * Never throws: a network failure, an abort or a reply that isn't JSON comes
 * back as a generic message, and an error reply as the route's own.
 */
export async function fetchCollectionOptions({
  signal,
}: { signal?: AbortSignal } = {}): Promise<CollectionOptionsResult> {
  try {
    const response = await fetch(COLLECTIONS_URL, { cache: "no-store", signal });
    const body = (await response.json()) as CollectionOptionsResponse;

    return response.ok && body.data
      ? { ok: true, collections: body.data }
      : { ok: false, message: body.error ?? COLLECTIONS_LOAD_FAILED };
  } catch {
    return { ok: false, message: COLLECTIONS_LOAD_FAILED };
  }
}
