import Image from "next/image";

import { ClickableCard } from "@/components/common/ClickableCard";
import { ItemCardMeta, ItemCardTitle } from "@/components/items/ItemCardParts";
import { TagList } from "@/components/items/TagList";
import type { ItemSummary } from "@/lib/db/items";
import { getItemThumbnailUrl, isImageFileName } from "@/lib/file-upload";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Gallery card for an image item: a 16:9 thumbnail that zooms slightly on
 * hover, then the title and the tag row ending in the date and favorite star,
 * laid out like `ItemCard`. The image comes through the download
 * proxy like the drawer's preview, so the bucket stays private. Clicking
 * anywhere on it opens the item drawer, through the button on its title.
 */
export function ImageCard({ item }: Readonly<{ item: ItemSummary }>) {
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(item.typeName);
  const hasImage = item.fileName !== null && isImageFileName(item.fileName);

  return (
    <ClickableCard className="gap-0 py-0">
      <div className={cn("relative aspect-video overflow-hidden", !hasImage && bgClass)}>
        {hasImage ? (
          <Image
            src={getItemThumbnailUrl(item.id)}
            alt={`Preview of ${item.fileName}`}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover/card:scale-105 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
          />
        ) : (
          <Icon aria-hidden className={cn("absolute inset-0 m-auto size-10", colorClass)} />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <ItemCardTitle item={item} />
        <TagList tags={item.tags}>
          <ItemCardMeta item={item} />
        </TagList>
      </div>
    </ClickableCard>
  );
}
