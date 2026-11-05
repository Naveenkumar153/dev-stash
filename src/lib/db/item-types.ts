import { cache } from "react";

import { getCurrentUserId } from "@/lib/db/user";
import { getItemTypeSlug } from "@/lib/item-types";
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

/**
 * The available type whose list lives at `/items/${slug}`, e.g. "snippets".
 * Matched exactly against the slug each type would produce rather than by
 * stripping a trailing "s", so "snippet", "Snippets", a typo or another user's
 * custom type is null - each list has one URL.
 *
 * Both lookups underneath are request-cached, so the page's metadata and its
 * list can each call this without repeating a query.
 */
export async function getItemTypeBySlug(slug: string): Promise<ItemTypeRow | null> {
  const types = await getAvailableTypes(await getCurrentUserId());

  return types.find((type) => getItemTypeSlug(type.name) === slug) ?? null;
}
