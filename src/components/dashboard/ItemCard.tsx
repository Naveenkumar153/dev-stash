import { Pin } from "lucide-react";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { OpenItemButton } from "@/components/items/OpenItemButton";
import { QuickCopyButton } from "@/components/items/QuickCopyButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/format";
import { toDrawerSummary } from "@/lib/item-summary";
import { getItemTypeLabel, getItemTypeStyleByName, isFileItemType } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Item row card, color-coded on its left edge by item type. Used for the
 * dashboard's pinned and recent lists and the /items/[type] grid. Clicking
 * anywhere on it opens the item drawer, through the button on its title. The
 * date, a favorite star and (for items with text or a URL) a copy icon end the
 * tag row, so the title keeps the card's full width.
 */
export function ItemCard({ item }: Readonly<{ item: ItemSummary }>) {
  const { icon: Icon, colorClass, borderClass, bgClass } =
    getItemTypeStyleByName(item.typeName);

  return (
    <Card
      className={cn(
        "relative gap-0 border-l-4 px-4 transition-colors hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
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
          <h3 className="flex items-start gap-2 font-heading text-base font-medium">
            <OpenItemButton item={toDrawerSummary(item)} className="line-clamp-2 wrap-anywhere">
              {item.title}
            </OpenItemButton>
            {item.isPinned && (
              <Pin
                aria-label="Pinned"
                className="mt-1 size-4 shrink-0 text-muted-foreground"
              />
            )}
          </h3>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}

          {/* The date and buttons sit here rather than beside the title, which
              left the title only a few characters in a narrow card. */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <time
                dateTime={item.createdAt.toISOString()}
                className="mr-1 text-xs text-muted-foreground"
              >
                {formatShortDate(item.createdAt)}
              </time>
              <FavoriteToggle
                kind="item"
                id={item.id}
                name={item.title}
                isFavorite={item.isFavorite}
                className="relative z-10 shrink-0"
              />
              {!isFileItemType(item.typeName) && (
                <QuickCopyButton itemId={item.id} itemTitle={item.title} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
