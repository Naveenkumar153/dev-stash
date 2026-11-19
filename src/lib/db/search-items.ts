/** The command palette's item query. */

import { NEWEST_FIRST } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";
import { getItemPreview } from "@/lib/search";
import type { SearchItem } from "@/types/search";

/** A palette row's columns: the stored preview, never the payload itself. */
const SEARCH_ITEM_SELECT = {
  id: true,
  title: true,
  isPinned: true,
  isFavorite: true,
  preview: true,
  itemType: { select: { name: true } },
} as const;

/**
 * Most items the palette loads, newest first. The palette filters in the
 * browser, so an older item past this can't be found there; at Free's 50 items
 * nothing is ever left out.
 */
export const SEARCH_ITEM_LIMIT = 2000;

/**
 * Previews for rows saved before `Item.preview` existed, cut from their
 * payloads here so search is right before the backfill has run. One query for
 * all of them, and none once every row has its preview.
 */
async function fillMissingPreviews(ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await prisma.item.findMany({
    where: { id: { in: ids } },
    select: { id: true, content: true, url: true, fileName: true },
  });
  return new Map(rows.map(({ id, ...payload }) => [id, getItemPreview(payload)]));
}

/**
 * The current user's newest items for the command palette, each with the
 * short preview stored beside it, so no item's full content is read here.
 */
export async function getSearchItems(): Promise<SearchItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const rows = await prisma.item.findMany({
    where: { userId },
    orderBy: [...NEWEST_FIRST],
    take: SEARCH_ITEM_LIMIT,
    select: SEARCH_ITEM_SELECT,
  });
  const filled = await fillMissingPreviews(
    rows.filter((row) => row.preview === null).map((row) => row.id),
  );

  return rows.map(({ itemType, preview, ...item }) => ({
    ...item,
    typeName: itemType.name,
    preview: preview ?? filled.get(item.id) ?? null,
  }));
}
