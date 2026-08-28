import {
  collections,
  items,
  itemTypes,
  type Collection,
  type Item,
} from "@/lib/mock-data";

const RECENT_COLLECTION_LIMIT = 6;
const RECENT_ITEM_LIMIT = 10;

export interface DashboardStats {
  items: number;
  collections: number;
  favoriteItems: number;
  favoriteCollections: number;
}

export interface CollectionSummary extends Collection {
  /** Type the collection holds most of - drives the card color. Null if empty. */
  dominantTypeId: string | null;
  /** Distinct type ids present in the collection, in item type order. */
  typeIds: string[];
}

/** Counts for the stats cards at the top of the dashboard. */
export function getDashboardStats(): DashboardStats {
  return {
    items: items.length,
    collections: collections.length,
    favoriteItems: items.filter((item) => item.isFavorite).length,
    favoriteCollections: collections.filter(
      (collection) => collection.isFavorite,
    ).length,
  };
}

/** Newest first. Ids are unique, so a plain string compare is enough. */
function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return b.createdAt.localeCompare(a.createdAt);
}

/**
 * Which types a collection holds, in item type order, with the most common one
 * first. Ties fall back to that same order.
 */
function summarize(collection: Collection): CollectionSummary {
  const collectionItems = items.filter((item) =>
    item.collectionIds.includes(collection.id),
  );

  const typeIds = itemTypes
    .map((type) => type.id)
    .filter((typeId) =>
      collectionItems.some((item) => item.itemTypeId === typeId),
    );

  const countOf = (typeId: string) =>
    collectionItems.filter((item) => item.itemTypeId === typeId).length;

  const dominantTypeId =
    [...typeIds].sort((a, b) => countOf(b) - countOf(a))[0] ?? null;

  return { ...collection, dominantTypeId, typeIds };
}

/** Most recently created collections, as cards for the main area. */
export function getRecentCollections(
  limit = RECENT_COLLECTION_LIMIT,
): CollectionSummary[] {
  return [...collections].sort(byNewest).slice(0, limit).map(summarize);
}

/** Items the user pinned to the top, newest first. */
export function getPinnedItems(): Item[] {
  return items.filter((item) => item.isPinned).sort(byNewest);
}

/** The latest items, newest first. */
export function getRecentItems(limit = RECENT_ITEM_LIMIT): Item[] {
  return [...items].sort(byNewest).slice(0, limit);
}

/**
 * "2026-01-15" -> "Jan 15". Formatted in UTC so the date never shifts by a day
 * between the server and the browser.
 */
export function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
