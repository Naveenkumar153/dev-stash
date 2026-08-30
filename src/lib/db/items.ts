import { connection } from "next/server";

import { getAvailableTypes } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import { compareItemTypeOrder } from "@/lib/item-types";
import { prisma } from "@/lib/prisma";

const RECENT_ITEM_LIMIT = 10;
const PINNED_ITEM_LIMIT = 10;

export interface ItemSummary {
  id: string;
  title: string;
  description: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  /** Item type name, e.g. "snippet" - drives the card's icon and colors. */
  typeName: string;
  tags: string[];
  createdAt: Date;
}

/** Everything a card needs, and nothing else - payloads stay out of the list. */
const ITEM_CARD_SELECT = {
  id: true,
  title: true,
  description: true,
  isPinned: true,
  isFavorite: true,
  createdAt: true,
  itemType: { select: { name: true } },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
} as const;

/** Newest first. createdAt ties break on id so the order is stable. */
const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const;

interface ItemRow {
  id: string;
  title: string;
  description: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  createdAt: Date;
  itemType: { name: string };
  tags: { name: string }[];
}

function toSummary({ itemType, tags, ...item }: ItemRow): ItemSummary {
  return { ...item, typeName: itemType.name, tags: tags.map((tag) => tag.name) };
}

/**
 * Items the user pinned to the top, newest first. Bounded like every other list
 * query - pinning is unlimited, so without a cap the section grows with the
 * number of items the user has pinned.
 */
export async function getPinnedItems(
  limit = PINNED_ITEM_LIMIT,
): Promise<ItemSummary[]> {
  // Keeps the dashboard out of the build-time prerender, so the lists render
  // from the database at request time. See getRecentCollections.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: [...NEWEST_FIRST],
    take: limit,
    select: ITEM_CARD_SELECT,
  });

  return items.map(toSummary);
}

/** The latest items, newest first. */
export async function getRecentItems(
  limit = RECENT_ITEM_LIMIT,
): Promise<ItemSummary[]> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: [...NEWEST_FIRST],
    take: limit,
    select: ITEM_CARD_SELECT,
  });

  return items.map(toSummary);
}

export interface ItemTypeCount {
  id: string;
  /** Item type name, e.g. "snippet" - drives the icon, colors and route. */
  name: string;
  /** How many of the user's items carry this type. */
  count: number;
}

/**
 * Every type the user can file an item under - the system types plus their own
 * custom ones - with their item counts, for the sidebar. Two queries rather
 * than one count per type, joined in memory.
 */
export async function getItemTypeCounts(): Promise<ItemTypeCount[]> {
  // See getRecentCollections: keeps the sidebar out of the prerender.
  await connection();

  const userId = await getCurrentUserId();

  const [types, counts] = await Promise.all([
    getAvailableTypes(userId),
    userId
      ? prisma.item.groupBy({
          by: ["itemTypeId"],
          where: { userId },
          _count: { _all: true },
        })
      : [],
  ]);

  const countByTypeId = new Map(
    counts.map((row) => [row.itemTypeId, row._count._all]),
  );

  // An unseeded database still lists the types, all at zero.
  return types
    .map((type) => ({ ...type, count: countByTypeId.get(type.id) ?? 0 }))
    .sort((a, b) => compareItemTypeOrder(a.name, b.name));
}
