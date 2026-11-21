import type { Metadata } from "next";
import { Star } from "lucide-react";

import { IconTile } from "@/components/common/IconTile";
import { FavoritesList } from "@/components/favorites/FavoritesList";
import { PageHeader } from "@/components/layout/PageHeader";
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
      <PageHeader
        icon={<IconTile icon={Star} size="lg" iconClassName="fill-amber-400 text-amber-400" />}
        title="Favorites"
        subtitle={formatCount(total, "favorite")}
      />

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
