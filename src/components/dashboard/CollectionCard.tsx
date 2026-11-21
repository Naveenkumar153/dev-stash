import Link from "next/link";

import { CollectionCardMenu } from "@/components/collections/CollectionCardMenu";
import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { ClickableCard } from "@/components/common/ClickableCard";
import type { CollectionSummary } from "@/lib/db/collections";
import { formatCount } from "@/lib/format";
import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Collection card, color-coded on its left edge by the item type the collection
 * holds most of. Empty collections fall back to the neutral border. The whole
 * card links to the collection's page, except its favorite star and "more
 * actions" menu.
 */
export function CollectionCard({
  collection,
}: Readonly<{ collection: CollectionSummary }>) {
  const { id, name, description, isFavorite, dominantTypeName, typeNames } = collection;
  const accent = dominantTypeName
    ? getItemTypeStyleByName(dominantTypeName).borderClass
    : "border-l-border";

  return (
    <ClickableCard className={cn("gap-3 border-l-4 px-4", accent)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-heading text-base font-medium">
            {/* outline-none: the card's own ring shows keyboard focus. */}
            <Link href={`/collections/${id}`} className="truncate outline-none">
              {/* Stretches over the card so the whole surface is clickable. */}
              <span aria-hidden className="absolute inset-0" />
              {name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatCount(collection.itemCount, "item")}
          </p>
        </div>
        {/* Both sit above the stretched link, so they work without navigating. */}
        <FavoriteToggle
          kind="collection"
          id={id}
          name={name}
          isFavorite={isFavorite}
          size="icon"
          className="relative z-10 shrink-0"
        />
        <CollectionCardMenu collection={{ id, name, description, isFavorite }} />
      </div>

      {description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2">
        {typeNames.map((typeName) => {
          const { icon: Icon, colorClass } = getItemTypeStyleByName(typeName);

          return (
            <Icon
              key={typeName}
              aria-label={getItemTypeLabel(typeName)}
              className={cn("size-4", colorClass)}
            />
          );
        })}
      </div>
    </ClickableCard>
  );
}
