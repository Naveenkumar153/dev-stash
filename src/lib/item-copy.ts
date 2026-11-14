import { CopyTextError } from "@/lib/clipboard";
import type { ItemDetail, ItemDetailResponse } from "@/types/items";

const LOAD_FAILED = "Couldn't load this item. Please try again.";
const NOTHING_TO_COPY = "This item has nothing to copy.";

/** What copying an item puts on the clipboard: a link's URL, otherwise its text content. */
export function getItemCopyText(item: ItemDetail) {
  return item.contentType === "url" ? item.url : item.content;
}

/**
 * Loads an item from `GET /api/items/[id]` and returns its copy text. Throws a
 * `CopyTextError` with a message for the user when the item can't be loaded or
 * has nothing to copy, such as a file item.
 */
export async function fetchItemCopyText(id: string): Promise<string> {
  let response: Response;
  let body: ItemDetailResponse;

  try {
    response = await fetch(`/api/items/${encodeURIComponent(id)}`, { cache: "no-store" });
    body = (await response.json()) as ItemDetailResponse;
  } catch {
    // Offline, or a reply that isn't JSON.
    throw new CopyTextError(LOAD_FAILED);
  }

  if (!response.ok || !body.data) {
    throw new CopyTextError(body.error ?? LOAD_FAILED);
  }

  const text = getItemCopyText(body.data);
  if (!text) {
    throw new CopyTextError(NOTHING_TO_COPY);
  }

  return text;
}
