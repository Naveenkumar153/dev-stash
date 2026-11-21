import { ClickableCard } from "@/components/common/ClickableCard";
import { ItemTypeIconTile } from "@/components/common/IconTile";
import { ItemCardMeta, ItemCardTitle } from "@/components/items/ItemCardParts";
import { TagList } from "@/components/items/TagList";
import type { ItemSummary } from "@/lib/db/items";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Item row card, color-coded on its left edge by item type. Used for the
 * dashboard's pinned and recent lists and the /items/[type] grid. Clicking
 * anywhere on it opens the item drawer, through the button on its title. The
 * date, a favorite star and (for items with text or a URL) a copy icon end the
 * tag row, so the title keeps the card's full width.
 */
export function ItemCard({ item }: Readonly<{ item: ItemSummary }>) {
  const { borderClass } = getItemTypeStyleByName(item.typeName);

  return (
    <ClickableCard className={cn("gap-0 border-l-4 px-4", borderClass)}>
      <div className="flex items-start gap-4">
        <ItemTypeIconTile typeName={item.typeName} labelled />

        <div className="min-w-0 flex-1">
          <ItemCardTitle item={item} />

          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}

          <TagList tags={item.tags} className="mt-3">
            <ItemCardMeta item={item} />
          </TagList>
        </div>
      </div>
    </ClickableCard>
  );
}
