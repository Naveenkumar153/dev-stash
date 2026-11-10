"use client";

import { ItemDrawerActions } from "@/components/items/ItemDrawerActions";
import { ItemDrawerDetails } from "@/components/items/ItemDrawerDetails";
import { ItemDrawerSkeleton } from "@/components/items/ItemDrawerSkeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ItemDetailState } from "@/hooks/use-item-detail";
import type { ItemSummary } from "@/lib/db/items";
import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";
import type { ItemDetail } from "@/types/items";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The card that was clicked. Null until the first item is opened. */
  summary: ItemSummary | null;
  detail: ItemDetailState;
}

/** What Copy puts on the clipboard: a link's URL, otherwise the text payload. */
function getCopyText(item: ItemDetail) {
  return item.contentType === "url" ? item.url : item.content;
}

/**
 * The item detail view: a right-side sheet over whichever page opened it. The
 * header and action bar render from the card's summary straight away; the body
 * waits for the full detail, showing a skeleton until it arrives.
 */
export function ItemDrawer({ open, onOpenChange, summary, detail }: ItemDrawerProps) {
  const item = detail.status === "ready" ? detail.item : null;
  const current = item ?? summary;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {current && (
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <ItemDrawerHeader
            title={current.title}
            typeName={current.typeName}
            language={item?.language ?? null}
          />

          <ItemDrawerActions
            isFavorite={current.isFavorite}
            isPinned={current.isPinned}
            copyText={item ? getCopyText(item) : null}
          />

          <div className="flex-1 overflow-y-auto p-6">
            <ItemDrawerBody detail={detail} />
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

function ItemDrawerBody({ detail }: Readonly<{ detail: ItemDetailState }>) {
  if (detail.status === "ready") {
    return <ItemDrawerDetails item={detail.item} />;
  }

  if (detail.status === "error") {
    return (
      <p role="alert" className="text-sm text-destructive">
        {detail.message}
      </p>
    );
  }

  return <ItemDrawerSkeleton />;
}

interface ItemDrawerHeaderProps {
  title: string;
  typeName: string;
  /** Null while the detail loads, or when the item has none. */
  language: string | null;
}

function ItemDrawerHeader({ title, typeName, language }: ItemDrawerHeaderProps) {
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(typeName);

  return (
    // Right padding clears the sheet's own close button.
    <div className="flex items-start gap-4 p-6 pr-14">
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-lg",
          bgClass,
        )}
      >
        <Icon aria-hidden className={cn("size-6", colorClass)} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SheetTitle className="text-lg font-semibold wrap-break-word">{title}</SheetTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{getItemTypeLabel(typeName)}</Badge>
          {language && <Badge variant="outline">{language}</Badge>}
        </div>
      </div>
    </div>
  );
}
