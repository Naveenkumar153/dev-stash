import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** An item type reduced to what a query needs to join or label it. */
export interface ItemTypeRow {
  id: string;
  name: string;
}

/**
 * Every type the user can file an item under: the system set plus their own
 * custom ones. Custom types are Pro-only and not built yet, but scoping the
 * query now means callers pick them up for free once they land.
 *
 * Cached per request like getCurrentUserId(), because the dashboard asks for
 * this list three times over - the sidebar's type counts, the sidebar's
 * collections and the main area's collections - and they all want the same rows.
 */
export const getAvailableTypes = cache(
  (userId: string | null): Promise<ItemTypeRow[]> =>
    prisma.itemType.findMany({
      where: userId ? { OR: [{ isSystem: true }, { userId }] } : { isSystem: true },
      select: { id: true, name: true },
    }),
);
