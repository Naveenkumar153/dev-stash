import { CopyTextError } from "@/lib/clipboard";
import { fetchItemDetail } from "@/lib/item-request";
import type { ItemDetail } from "@/types/items";

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
  const result = await fetchItemDetail(id);
  if (!result.ok) {
    throw new CopyTextError(result.message);
  }

  const text = getItemCopyText(result.item);
  if (!text) {
    throw new CopyTextError(NOTHING_TO_COPY);
  }

  return text;
}
