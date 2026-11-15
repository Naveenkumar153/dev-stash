import type { ItemDrawerSummary } from "@/types/items";

/**
 * Only the fields the item drawer reads from a card. A server component card
 * passes this to the client `OpenItemButton` instead of its whole item, so
 * descriptions, tags and file details aren't sent to the browser a second time.
 */
export function toDrawerSummary({
  id,
  title,
  typeName,
  isPinned,
  isFavorite,
}: ItemDrawerSummary): ItemDrawerSummary {
  return { id, title, typeName, isPinned, isFavorite };
}
