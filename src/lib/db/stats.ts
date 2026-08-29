import { connection } from "next/server";

import { getCurrentUserId } from "@/lib/db/user";
import { prisma } from "@/lib/prisma";

export interface DashboardStats {
  items: number;
  collections: number;
  favoriteItems: number;
  favoriteCollections: number;
}

const EMPTY_STATS: DashboardStats = {
  items: 0,
  collections: 0,
  favoriteItems: 0,
  favoriteCollections: 0,
};

/** Counts for the stats cards at the top of the dashboard. */
export async function getDashboardStats(): Promise<DashboardStats> {
  // See getRecentCollections: keeps these counts out of the prerender.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return EMPTY_STATS;
  }

  const [items, collections, favoriteItems, favoriteCollections] =
    await Promise.all([
      prisma.item.count({ where: { userId } }),
      prisma.collection.count({ where: { userId } }),
      prisma.item.count({ where: { userId, isFavorite: true } }),
      prisma.collection.count({ where: { userId, isFavorite: true } }),
    ]);

  return { items, collections, favoriteItems, favoriteCollections };
}
