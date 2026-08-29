import Link from "next/link";
import { Pin, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/format";
import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Item row card, color-coded on its left edge by item type. Used for both the
 * pinned and the recent lists.
 */
export function ItemCard({ item }: Readonly<{ item: ItemSummary }>) {
  const { icon: Icon, colorClass, borderClass, bgClass } =
    getItemTypeStyleByName(item.typeName);

  return (
    <Card
      className={cn(
        "relative gap-0 border-l-4 px-4 transition-colors hover:bg-accent/50",
        borderClass,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            bgClass,
          )}
        >
          <Icon
            aria-label={getItemTypeLabel(item.typeName)}
            className={cn("size-5", colorClass)}
          />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-heading text-base font-medium">
            <Link href={`/items/${item.id}`} className="truncate">
              {/* Stretches over the card so the whole surface is clickable. */}
              <span aria-hidden className="absolute inset-0" />
              {item.title}
            </Link>
            {item.isPinned && (
              <Pin
                aria-label="Pinned"
                className="size-4 shrink-0 text-muted-foreground"
              />
            )}
            {item.isFavorite && (
              <Star
                aria-label="Favorite"
                className="size-4 shrink-0 fill-amber-400 text-amber-400"
              />
            )}
          </h3>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}

          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <time
          dateTime={item.createdAt.toISOString()}
          className="hidden shrink-0 text-xs text-muted-foreground sm:block"
        >
          {formatShortDate(item.createdAt)}
        </time>
      </div>
    </Card>
  );
}
