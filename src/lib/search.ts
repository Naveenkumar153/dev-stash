import type { CollectionSummary } from "@/lib/db/collections";
import type { SearchCollection } from "@/types/search";

/** Characters of an item's payload kept for the palette to show and match. */
export const SEARCH_PREVIEW_LENGTH = 200;

/**
 * A single-line excerpt of `text`: runs of whitespace (newlines included)
 * collapsed to one space, trimmed, and cut to `maxLength` characters with an
 * ellipsis. Null for missing or blank text.
 */
export function toSearchPreview(
  text: string | null | undefined,
  maxLength = SEARCH_PREVIEW_LENGTH,
): string | null {
  const collapsed = text?.replace(/\s+/g, " ").trim();

  if (!collapsed) {
    return null;
  }

  return collapsed.length > maxLength
    ? `${collapsed.slice(0, maxLength).trimEnd()}…`
    : collapsed;
}

interface ItemPayload {
  content: string | null;
  url: string | null;
  fileName: string | null;
}

/**
 * The payload a palette row previews: a link's URL, a file's name, otherwise
 * the text content. Whichever is set first, in that order.
 */
export function getItemPreview({ content, url, fileName }: ItemPayload): string | null {
  return toSearchPreview(url) ?? toSearchPreview(fileName) ?? toSearchPreview(content);
}

/** A collection card's summary, trimmed to what the palette shows. */
export function toSearchCollection({
  id,
  name,
  itemCount,
  dominantTypeName,
}: CollectionSummary): SearchCollection {
  return { id, name, itemCount, dominantTypeName };
}
