import { Pin } from "lucide-react";
import Image from "next/image";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { OpenItemButton } from "@/components/items/OpenItemButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ItemSummary } from "@/lib/db/items";
import { getItemThumbnailUrl, isImageFileName } from "@/lib/file-upload";
import { formatShortDate } from "@/lib/format";
import { toDrawerSummary } from "@/lib/item-summary";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/**
 * Gallery card for an image item: a 16:9 thumbnail that zooms slightly on
 * hover, then the title, tags and date. The image comes through the download
 * proxy like the drawer's preview, so the bucket stays private. Clicking
 * anywhere on it opens the item drawer, through the button on its title.
 */
export function ImageCard({ item }: Readonly<{ item: ItemSummary }>) {
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(item.typeName);
  const hasImage = item.fileName !== null && isImageFileName(item.fileName);

  return (
    <Card className="relative gap-0 py-0 transition-colors hover:bg-accent/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
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
        <div className="flex items-center gap-2">
          <h3 className="flex min-w-0 flex-1 items-center gap-2 font-heading text-base font-medium">
            <OpenItemButton item={toDrawerSummary(item)} className="truncate">
              {item.title}
            </OpenItemButton>
            {item.isPinned && (
              <Pin aria-label="Pinned" className="size-4 shrink-0 text-muted-foreground" />
            )}
          </h3>
          <time
            dateTime={item.createdAt.toISOString()}
            className="shrink-0 text-xs text-muted-foreground"
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
        </div>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
