import { connection } from "next/server";

import { getAvailableTypes, type ItemTypeRow } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import { compareItemTypeOrder } from "@/lib/item-types";
import { prisma } from "@/lib/prisma";

const RECENT_COLLECTION_LIMIT = 6;
const SIDEBAR_COLLECTION_LIMIT = 5;

/** Newest first. createdAt ties break on id so the order is stable. */
const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const;

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  itemCount: number;
  /** Type the collection holds most of - drives the card color. Null if empty. */
  dominantTypeName: string | null;
  /** Distinct type names present in the collection, in item type order. */
  typeNames: string[];
}

/** A collection card's own columns. The item count is counted by the database. */
interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  _count: { items: number };
}

/**
 * A card's columns plus its size. Counting in the database keeps the query flat:
 * loading the join rows in order to measure them costs one row per item in the
 * collection, unbounded, to produce a single number.
 */
const COLLECTION_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  isFavorite: true,
  _count: { select: { items: true } },
} as const;

/** How many items of each type a collection holds, keyed by collection id. */
type TypeCounts = Map<string, Map<string, number>>;

/**
 * The type breakdown behind the cards, aggregated by the database rather than
 * by loading every membership row.
 *
 * One grouped query per item type: `groupBy` only groups on a model's own
 * scalar fields, and item_collections carries no type column, so the split has
 * to come from the filter instead. That trades row volume for query count,
 * which is the right way round here - types are a small fixed set (7 system
 * ones), while items per collection grows without limit. The queries are
 * independent, so they cost about one round trip in total.
 *
 * Worth revisiting if custom types ever arrive in bulk: this scales with the
 * number of types a user has, not with the number of items.
 */
async function getTypeCounts(
  collectionIds: string[],
  types: ItemTypeRow[],
): Promise<TypeCounts> {
  const counts: TypeCounts = new Map(collectionIds.map((id) => [id, new Map()]));

  if (collectionIds.length === 0) {
    return counts;
  }

  const groups = await Promise.all(
    types.map((type) =>
      prisma.itemCollection.groupBy({
        by: ["collectionId"],
        where: { collectionId: { in: collectionIds }, item: { itemTypeId: type.id } },
        _count: { _all: true },
      }),
    ),
  );

  groups.forEach((rows, index) => {
    const typeName = types[index].name;

    for (const row of rows) {
      const collectionCounts = counts.get(row.collectionId);

      // Added rather than set: a custom type can share a system type's name,
      // and setting would drop whichever was counted first.
      collectionCounts?.set(
        typeName,
        (collectionCounts.get(typeName) ?? 0) + row._count._all,
      );
    }
  });

  return counts;
}

/**
 * Which types a collection holds, in item type order, with the most common one
 * first. Sorting is stable, so ties fall back to that same order.
 */
function summarize(
  { _count, ...collection }: CollectionRow,
  typeCounts: TypeCounts,
): CollectionSummary {
  const counts = typeCounts.get(collection.id) ?? new Map<string, number>();

  const typeNames = [...counts.keys()].sort(compareItemTypeOrder);
  const dominantTypeName =
    [...typeNames].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0] ??
    null;

  return {
    ...collection,
    itemCount: _count.items,
    dominantTypeName,
    typeNames,
  };
}

/**
 * Most recently created collections, as cards for the main area. One query:
 * the item types come back with the collections rather than per card.
 */
export async function getRecentCollections(
  limit = RECENT_COLLECTION_LIMIT,
): Promise<CollectionSummary[]> {
  // Keeps the dashboard out of the build-time prerender, so cards render from
  // the database at request time. Session access will imply this once auth
  // lands.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  // The type list does not depend on which collections come back, so it goes
  // out with them rather than adding a stage.
  const [collections, types] = await Promise.all([
    prisma.collection.findMany({
      where: { userId },
      orderBy: [...NEWEST_FIRST],
      take: limit,
      select: COLLECTION_SUMMARY_SELECT,
    }),
    getAvailableTypes(userId),
  ]);

  const typeCounts = await getTypeCounts(
    collections.map((collection) => collection.id),
    types,
  );

  return collections.map((collection) => summarize(collection, typeCounts));
}

export interface SidebarCollections {
  favorites: CollectionSummary[];
  /** The newest collections the user has not favorited. */
  recent: CollectionSummary[];
}

const EMPTY_SIDEBAR_COLLECTIONS: SidebarCollections = {
  favorites: [],
  recent: [],
};

/**
 * The two collection lists in the sidebar. Favorites are pulled out first so a
 * favorited collection never also shows up under Recent.
 */
export async function getSidebarCollections(
  limit = SIDEBAR_COLLECTION_LIMIT,
): Promise<SidebarCollections> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return EMPTY_SIDEBAR_COLLECTIONS;
  }

  const [favorites, recent, types] = await Promise.all([
    prisma.collection.findMany({
      where: { userId, isFavorite: true },
      orderBy: [...NEWEST_FIRST],
      take: limit,
      select: COLLECTION_SUMMARY_SELECT,
    }),
    prisma.collection.findMany({
      where: { userId, isFavorite: false },
      orderBy: [...NEWEST_FIRST],
      take: limit,
      select: COLLECTION_SUMMARY_SELECT,
    }),
    getAvailableTypes(userId),
  ]);

  // Both lists in one pass, so the sidebar counts the types once.
  const typeCounts = await getTypeCounts(
    [...favorites, ...recent].map((collection) => collection.id),
    types,
  );

  return {
    favorites: favorites.map((collection) => summarize(collection, typeCounts)),
    recent: recent.map((collection) => summarize(collection, typeCounts)),
  };
}
