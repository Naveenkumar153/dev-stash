import type { Metadata } from "next";
import { Star } from "lucide-react";

import { FavoritesList } from "@/components/favorites/FavoritesList";
import { getFavoriteCollections } from "@/lib/db/collections";
import { getFavoriteItems } from "@/lib/db/items";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Favorites | DevStash" };

/**
 * Every favorited item and collection as a compact list, most recently
 * favorited first until another sort is picked. Items open in the drawer; collections link to their page.
 */
export default async function FavoritesPage() {
  const [items, collections] = await Promise.all([getFavoriteItems(), getFavoriteCollections()]);
  const total = items.length + collections.length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Star aria-hidden className="size-6 fill-amber-400 text-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold">Favorites</h1>
          <p className="mt-1 text-muted-foreground">{formatCount(total, "favorite")}</p>
        </div>
      </header>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No favorites yet. Star an item or a collection to see it here.
        </p>
      ) : (
        <FavoritesList items={items} collections={collections} />
      )}
    </div>
  );
}
