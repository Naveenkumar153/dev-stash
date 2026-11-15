"use client";

import { useState } from "react";

import {
  FavoriteCollectionRow,
  FavoriteItemRow,
  FavoritesSection,
} from "@/components/favorites/FavoriteRows";
import { SortControl } from "@/components/sort/SortControl";
import {
  DEFAULT_FAVORITE_SORT,
  FAVORITE_SORT_FIELDS,
  sortFavoriteCollections,
  sortFavoriteItems,
} from "@/lib/favorites-sort";
import type { FavoriteCollection, FavoriteItem } from "@/types/favorites";

interface FavoritesListProps {
  items: FavoriteItem[];
  collections: FavoriteCollection[];
}

/**
 * The /favorites sections with a Sort control over both. Sorting happens in
 * the browser over the rows the page loaded and resets on reload.
 */
export function FavoritesList({ items, collections }: Readonly<FavoritesListProps>) {
  const [sort, setSort] = useState(DEFAULT_FAVORITE_SORT);
  const sortedItems = sortFavoriteItems(items, sort);
  const sortedCollections = sortFavoriteCollections(collections, sort);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SortControl fields={FAVORITE_SORT_FIELDS} sort={sort} onChange={setSort} />
      </div>

      <div className="flex flex-col gap-6 font-mono text-sm">
        <FavoritesSection
          id="favorite-items-heading"
          title="Items"
          count={items.length}
          emptyMessage="No favorite items."
        >
          {sortedItems.map((item) => (
            <FavoriteItemRow key={item.id} item={item} />
          ))}
        </FavoritesSection>

        <FavoritesSection
          id="favorite-collections-heading"
          title="Collections"
          count={collections.length}
          emptyMessage="No favorite collections."
        >
          {sortedCollections.map((collection) => (
            <FavoriteCollectionRow key={collection.id} collection={collection} />
          ))}
        </FavoritesSection>
      </div>
    </div>
  );
}
