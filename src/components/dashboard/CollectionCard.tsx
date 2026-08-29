import Link from "next/link";
import { Star } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { CollectionSummary } from "@/lib/db/collections";
import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Collection card, color-coded on its left edge by the item type the collection
 * holds most of. Empty collections fall back to the neutral border.
 */
export function CollectionCard({
  collection,
}: Readonly<{ collection: CollectionSummary }>) {
  const { dominantTypeName, typeNames } = collection;
  const accent = dominantTypeName
    ? getItemTypeStyleByName(dominantTypeName).borderClass
    : "border-l-border";

  return (
    <Card
      className={cn(
        "relative gap-3 border-l-4 px-4 transition-colors hover:bg-accent/50",
        accent,
      )}
    >
      <div>
        <h3 className="flex items-center gap-2 font-heading text-base font-medium">
          <Link href={`/collections/${collection.id}`} className="truncate">
            {/* Stretches over the card so the whole surface is clickable. */}
            <span aria-hidden className="absolute inset-0" />
            {collection.name}
          </Link>
          {collection.isFavorite && (
            <Star
              aria-label="Favorite"
              className="size-4 shrink-0 fill-amber-400 text-amber-400"
            />
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          {collection.itemCount} items
        </p>
      </div>

      {collection.description && (
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {collection.description}
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
    </Card>
  );
}
