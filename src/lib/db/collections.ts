import { connection } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import type { CreateCollectionData, UpdateCollectionData } from "@/lib/collection-schemas";
import { getAvailableTypes, type ItemTypeRow } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import { compareItemTypeOrder } from "@/lib/item-types";
import {
  COLLECTIONS_PER_PAGE,
  DASHBOARD_COLLECTIONS_LIMIT,
  getPageSkip,
  type Page,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { CollectionOption } from "@/types/collections";
import type { FavoriteCollection } from "@/types/favorites";

const SIDEBAR_COLLECTION_LIMIT = 5;

/** Newest first. createdAt ties break on id so the order is stable. */
const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const;

/**
 * Most recently changed first. There's no favorited-at column, so updatedAt
 * stands in for when a collection was favorited; ties break on id.
 */
const RECENTLY_UPDATED = [{ updatedAt: "desc" }, { id: "desc" }] as const;

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

/** Which slice of the newest-first list to load; all of it when both are unset. */
interface CollectionSlice {
  skip?: number;
  take?: number;
}

/**
 * The current user's collections as cards, newest first, the `slice` of them
 * asked for. One query for the rows: the item types come back with them
 * rather than per card.
 */
async function listCollections({ skip, take }: CollectionSlice = {}): Promise<
  CollectionSummary[]
> {
  // Keeps the page out of the build-time prerender, so cards render from the
  // database at request time.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { rows, typeCounts } = await withTypeCounts(
    userId,
    prisma.collection.findMany({
      where: { userId },
      orderBy: [...NEWEST_FIRST],
      skip,
      take,
      select: COLLECTION_SUMMARY_SELECT,
    }),
  );

  return rows.map((collection) => summarize(collection, typeCounts));
}

/**
 * Collection rows plus the type breakdown behind their summaries. The type
 * list does not depend on which collections come back, so it goes out with
 * the rows rather than adding a stage.
 */
async function withTypeCounts<T extends CollectionRow>(
  userId: string,
  findRows: Promise<T[]>,
): Promise<{ rows: T[]; typeCounts: TypeCounts }> {
  const [rows, types] = await Promise.all([findRows, getAvailableTypes(userId)]);
  const typeCounts = await getTypeCounts(
    rows.map((row) => row.id),
    types,
  );

  return { rows, typeCounts };
}

/**
 * Every collection the user favorited, most recently favorited (updated)
 * first, for /favorites. Uncapped: favorites are picked by hand.
 */
export async function getFavoriteCollections(): Promise<FavoriteCollection[]> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { rows, typeCounts } = await withTypeCounts(
    userId,
    prisma.collection.findMany({
      where: { userId, isFavorite: true },
      orderBy: [...RECENTLY_UPDATED],
      select: { ...COLLECTION_SUMMARY_SELECT, updatedAt: true },
    }),
  );

  return rows.map((row) => {
    const { id, name, itemCount, dominantTypeName } = summarize(row, typeCounts);

    return { id, name, itemCount, dominantTypeName, updatedAt: row.updatedAt };
  });
}

/** Most recently created collections, as cards for the dashboard. */
export async function getRecentCollections(
  limit = DASHBOARD_COLLECTIONS_LIMIT,
): Promise<CollectionSummary[]> {
  return listCollections({ take: limit });
}

/**
 * Every collection, newest first, for the command palette, which filters
 * them in the browser.
 */
export async function getCollections(): Promise<CollectionSummary[]> {
  return listCollections();
}

/** How many collections the current user has; 0 without a user. */
async function countCollections(): Promise<number> {
  await connection();

  const userId = await getCurrentUserId();

  return userId ? prisma.collection.count({ where: { userId } }) : 0;
}

/**
 * Page `page` (1-based) of the collections for /collections, newest first,
 * plus how many there are in all. The page and the count go out together.
 */
export async function getCollectionPage(page: number): Promise<Page<CollectionSummary>> {
  const [rows, total] = await Promise.all([
    listCollections({
      skip: getPageSkip(page, COLLECTIONS_PER_PAGE),
      take: COLLECTIONS_PER_PAGE,
    }),
    countCollections(),
  ]);

  return { rows, total };
}

/** What a collection's own page shows above its items, and what its menus edit. */
export interface CollectionHeader {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
}

const COLLECTION_HEADER_SELECT = {
  id: true,
  name: true,
  description: true,
  isFavorite: true,
} as const;

/**
 * The collection at /collections/[id] when it's the current user's; null for
 * a missing one or another user's, so the page can 404 either way.
 */
export async function getCollection(id: string): Promise<CollectionHeader | null> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  return prisma.collection.findFirst({
    where: { id, userId },
    select: COLLECTION_HEADER_SELECT,
  });
}

/** True for Prisma's "no record matched" error, raised by a scoped update or delete. */
function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/**
 * Renames or re-describes one of `userId`'s collections. Ownership and the
 * write are one statement; null when there is no such collection or it
 * belongs to someone else.
 */
export async function updateCollection(
  userId: string,
  id: string,
  data: UpdateCollectionData,
): Promise<CollectionHeader | null> {
  try {
    return await prisma.collection.update({
      where: { id, userId },
      data: { name: data.name, description: data.description },
      select: COLLECTION_HEADER_SELECT,
    });
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Sets whether one of `userId`'s collections is a favorite, in one scoped
 * statement. Prisma bumps `updatedAt` with it, which is what /favorites sorts
 * by. False when there is no such collection or it's someone else's.
 */
export async function setCollectionFavorite(
  userId: string,
  id: string,
  isFavorite: boolean,
): Promise<boolean> {
  try {
    await prisma.collection.update({
      where: { id, userId },
      data: { isFavorite },
      select: { id: true },
    });
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
}

/**
 * Deletes one of `userId`'s collections in one scoped statement. Its join rows
 * cascade, so its items only leave the collection; the items themselves are
 * untouched. False when there is no such collection or it's someone else's.
 */
export async function deleteCollection(userId: string, id: string): Promise<boolean> {
  try {
    await prisma.collection.delete({ where: { id, userId }, select: { id: true } });
    return true;
  } catch (error) {
    if (isNotFound(error)) {
      return false;
    }
    throw error;
  }
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

/**
 * Creates a collection owned by `userId` and returns it as a card. A new
 * collection holds no items, so its type breakdown is empty without a query.
 */
export async function createCollection(
  userId: string,
  data: CreateCollectionData,
): Promise<CollectionSummary> {
  const collection = await prisma.collection.create({
    data: { userId, name: data.name, description: data.description },
    select: COLLECTION_SUMMARY_SELECT,
  });

  return summarize(collection, new Map());
}

/**
 * Every collection `userId` owns, by name, for the item forms' Collections
 * picker. Only ids and names: the picker shows nothing else.
 */
export async function getCollectionOptions(userId: string): Promise<CollectionOption[]> {
  return prisma.collection.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true },
  });
}

/**
 * Whether every id in `collectionIds` is one of `userId`'s collections, so an
 * item can't be put in someone else's collection or a deleted one. Expects
 * the ids deduplicated, as the item schemas leave them. No query for none.
 */
export async function ownsCollections(userId: string, collectionIds: string[]): Promise<boolean> {
  if (collectionIds.length === 0) {
    return true;
  }

  const owned = await prisma.collection.count({
    where: { userId, id: { in: collectionIds } },
  });

  return owned === collectionIds.length;
}
