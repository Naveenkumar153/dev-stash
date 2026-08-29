import { connection } from "next/server";

import { getCurrentUserId } from "@/lib/db/user";
import { compareItemTypeOrder } from "@/lib/item-types";
import { prisma } from "@/lib/prisma";

const RECENT_COLLECTION_LIMIT = 6;
const SIDEBAR_COLLECTION_LIMIT = 5;

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

/** The join rows a collection query loads, one per item in the collection. */
interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  items: { item: { itemType: { name: string } } }[];
}

/** A collection plus the item types behind it, in one round trip. */
const COLLECTION_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  isFavorite: true,
  items: {
    select: { item: { select: { itemType: { select: { name: true } } } } },
  },
} as const;

/**
 * Which types a collection holds, in item type order, with the most common one
 * first. Sorting is stable, so ties fall back to that same order.
 */
function summarize({ items, ...collection }: CollectionRow): CollectionSummary {
  const counts = new Map<string, number>();

  for (const { item } of items) {
    const name = item.itemType.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const typeNames = [...counts.keys()].sort(compareItemTypeOrder);
  const dominantTypeName =
    [...typeNames].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))[0] ??
    null;

  return {
    ...collection,
    itemCount: items.length,
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

  const collections = await prisma.collection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: COLLECTION_SUMMARY_SELECT,
  });

  return collections.map(summarize);
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

  const [favorites, recent] = await Promise.all([
    prisma.collection.findMany({
      where: { userId, isFavorite: true },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: COLLECTION_SUMMARY_SELECT,
    }),
    prisma.collection.findMany({
      where: { userId, isFavorite: false },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: COLLECTION_SUMMARY_SELECT,
    }),
  ]);

  return { favorites: favorites.map(summarize), recent: recent.map(summarize) };
}
