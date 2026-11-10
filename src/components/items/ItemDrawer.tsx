"use client";

import { useState } from "react";

import { ItemDrawerActions } from "@/components/items/ItemDrawerActions";
import { ItemDrawerDetails } from "@/components/items/ItemDrawerDetails";
import { ItemDrawerEditForm } from "@/components/items/ItemDrawerEditForm";
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
  /** Takes the item a save returned, so the drawer shows it without a refetch. */
  onItemSaved: (item: ItemDetail) => void;
  /** Runs after the open item has been deleted. */
  onItemDeleted: () => void;
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
export function ItemDrawer({
  open,
  onOpenChange,
  summary,
  detail,
  onItemSaved,
  onItemDeleted,
}: ItemDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {summary && (
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <ItemDrawerPanel
            summary={summary}
            detail={detail}
            onItemSaved={onItemSaved}
            onItemDeleted={onItemDeleted}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}

interface ItemDrawerPanelProps {
  summary: ItemSummary;
  detail: ItemDetailState;
  onItemSaved: (item: ItemDetail) => void;
  onItemDeleted: () => void;
}

/**
 * The sheet's contents, in view or edit mode. It sits inside the popup, which
 * unmounts once the sheet has closed, so edit mode and any unsaved changes
 * never carry over to the next item opened.
 */
function ItemDrawerPanel({ summary, detail, onItemSaved, onItemDeleted }: ItemDrawerPanelProps) {
  const [editing, setEditing] = useState(false);
  // Leaving edit mode unmounts the focused Save or Cancel button, so focus goes
  // back to the Edit button the user started from rather than the popup itself.
  const [focusEdit, setFocusEdit] = useState(false);
  const item = detail.status === "ready" ? detail.item : null;
  const current = item ?? summary;

  function stopEditing() {
    setEditing(false);
    setFocusEdit(true);
  }

  function handleSaved(saved: ItemDetail) {
    onItemSaved(saved);
    stopEditing();
  }

  return (
    <>
      <ItemDrawerHeader
        title={current.title}
        typeName={current.typeName}
        language={item?.language ?? null}
      />

      {editing && item ? (
        <ItemDrawerEditForm item={item} onCancel={stopEditing} onSaved={handleSaved} />
      ) : (
        <>
          <ItemDrawerActions
            itemId={current.id}
            itemTitle={current.title}
            canDelete={item !== null}
            onDeleted={onItemDeleted}
            isFavorite={current.isFavorite}
            isPinned={current.isPinned}
            copyText={item ? getCopyText(item) : null}
            onEdit={item ? () => setEditing(true) : undefined}
            focusEdit={focusEdit}
          />

          <div className="flex-1 overflow-y-auto p-6">
            <ItemDrawerBody detail={detail} />
          </div>
        </>
      )}
    </>
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
