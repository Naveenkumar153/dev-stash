import { Pin } from "lucide-react";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { OpenItemButton } from "@/components/items/OpenItemButton";
import { QuickCopyButton } from "@/components/items/QuickCopyButton";
import type { ItemSummary } from "@/lib/db/items";
import { formatShortDate } from "@/lib/format";
import { toDrawerSummary } from "@/lib/item-summary";
import { isFileItemType } from "@/lib/item-types";

/**
 * An item card's title, which opens the drawer and is stretched over the
 * card, up to two lines, with a pin when the item is pinned.
 */
export function ItemCardTitle({ item }: Readonly<{ item: ItemSummary }>) {
  return (
    <h3 className="flex items-start gap-2 font-heading text-base font-medium">
      <OpenItemButton item={toDrawerSummary(item)} className="line-clamp-2 wrap-anywhere">
        {item.title}
      </OpenItemButton>
      {item.isPinned && (
        <Pin aria-label="Pinned" className="mt-1 size-4 shrink-0 text-muted-foreground" />
      )}
    </h3>
  );
}

/**
 * An item card's date, favorite star and (for items with text or a URL) copy
 * button, pushed to the end of the tag row. The buttons sit above the card's
 * stretched title, so they work without opening the drawer.
 */
export function ItemCardMeta({ item }: Readonly<{ item: ItemSummary }>) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <time dateTime={item.createdAt.toISOString()} className="mr-1 text-xs text-muted-foreground">
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
  );
}
