import { connection } from "next/server";

import { getCurrentUserId } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";

const RECENT_ITEM_LIMIT = 10;

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

/** Items the user pinned to the top, newest first. */
export async function getPinnedItems(): Promise<ItemSummary[]> {
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
