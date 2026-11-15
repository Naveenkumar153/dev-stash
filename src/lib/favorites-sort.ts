import { compareItemTypeOrder } from "@/lib/item-types";
import { nameCollator, type Sort, type SortDirection, type SortFieldOption } from "@/lib/sort";
import type { FavoriteCollection, FavoriteItem } from "@/types/favorites";

/**
 * The /favorites sort fields. Date is `updatedAt`, which stands in for when a
 * row was favorited; Type follows the sidebar's type order, custom types last.
 */
export const FAVORITE_SORT_FIELDS = [
  { value: "date", label: "Date", defaultDirection: "desc", asc: "Oldest first", desc: "Newest first" },
  { value: "name", label: "Name", defaultDirection: "asc", asc: "A to Z", desc: "Z to A" },
  { value: "type", label: "Type", defaultDirection: "asc", asc: "Type order", desc: "Reverse type order" },
] as const satisfies readonly SortFieldOption<string>[];

export type FavoriteSortField = (typeof FAVORITE_SORT_FIELDS)[number]["value"];

export type FavoriteSort = Sort<FavoriteSortField>;

/** Newest first, the order the server returns. */
export const DEFAULT_FAVORITE_SORT: FavoriteSort = { field: "date", direction: "desc" };

interface SortableFavorite {
  id: string;
  updatedAt: Date;
}

type Compare<T> = (a: T, b: T) => number;

/** Oldest first; updatedAt ties break on id, so the order is stable. */
const byUpdated: Compare<SortableFavorite> = (a, b) =>
  a.updatedAt.getTime() - b.updatedAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Sorts by `compare`, then by date, all in one direction, so flipping the
 * direction reverses the list exactly.
 */
function sortWith<T extends SortableFavorite>(
  entries: readonly T[],
  compare: Compare<T>,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => sign * (compare(a, b) || byUpdated(a, b)));
}

function compareFor<T extends SortableFavorite>(
  field: FavoriteSortField,
  nameOf: (entry: T) => string,
  typeOf: (entry: T) => string,
): Compare<T> {
  const byName: Compare<T> = (a, b) => nameCollator.compare(nameOf(a), nameOf(b));

  if (field === "name") {
    return byName;
  }
  if (field === "type") {
    return (a, b) => compareItemTypeOrder(typeOf(a), typeOf(b)) || byName(a, b);
  }
  return () => 0;
}

/** Favorite items in a sort's order: by title, by type then title, or by date. */
export function sortFavoriteItems<T extends FavoriteItem>(
  items: readonly T[],
  { field, direction }: FavoriteSort,
): T[] {
  return sortWith(
    items,
    compareFor<T>(field, (item) => item.title, (item) => item.typeName),
    direction,
  );
}

/**
 * Favorite collections in a sort's order. Under Type they sort by the type they
 * hold most of, and empty collections (no dominant type) go last either way.
 */
export function sortFavoriteCollections<T extends FavoriteCollection>(
  collections: readonly T[],
  { field, direction }: FavoriteSort,
): T[] {
  const compare = compareFor<T>(
    field,
    (collection) => collection.name,
    (collection) => collection.dominantTypeName ?? "",
  );

  if (field !== "type") {
    return sortWith(collections, compare, direction);
  }

  return [
    ...sortWith(collections.filter((c) => c.dominantTypeName !== null), compare, direction),
    ...sortWith(collections.filter((c) => c.dominantTypeName === null), compare, direction),
  ];
}
