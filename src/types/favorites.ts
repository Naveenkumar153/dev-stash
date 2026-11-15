import type { ItemDrawerSummary } from "@/types/items";

/**
 * A favorited item as a /favorites row: what the drawer needs plus when it was
 * last changed, which stands in for when it was favorited.
 */
export interface FavoriteItem extends ItemDrawerSummary {
  updatedAt: Date;
}

/** A favorited collection as a /favorites row. */
export interface FavoriteCollection {
  id: string;
  name: string;
  itemCount: number;
  /** Type the collection holds most of - tints its icon. Null if empty. */
  dominantTypeName: string | null;
  updatedAt: Date;
}

/** Result of `setItemFavorite()` / `setCollectionFavorite()`: the saved state. */
export interface SetFavoriteResult {
  success: boolean;
  data: { id: string; isFavorite: boolean } | null;
  error: string | null;
}
