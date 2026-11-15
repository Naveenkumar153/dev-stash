import { ITEM_LOAD_FAILED } from "@/lib/action-result";
import type { ItemDetail, ItemDetailResponse } from "@/types/items";

export type ItemDetailResult = { ok: true; item: ItemDetail } | { ok: false; message: string };

/**
 * Loads an item's full detail from `GET /api/items/[id]`, bypassing the HTTP
 * cache. Never throws: a network failure, an abort or a reply that isn't JSON
 * comes back as a generic message, and an error reply as the route's own.
 */
export async function fetchItemDetail(
  id: string,
  { signal }: { signal?: AbortSignal } = {},
): Promise<ItemDetailResult> {
  try {
    const response = await fetch(`/api/items/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal,
    });
    const body = (await response.json()) as ItemDetailResponse;

    return response.ok && body.data
      ? { ok: true, item: body.data }
      : { ok: false, message: body.error ?? ITEM_LOAD_FAILED };
  } catch {
    return { ok: false, message: ITEM_LOAD_FAILED };
  }
}
