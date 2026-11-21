"use client";

import type { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";

import { ItemTypeIconTile } from "@/components/common/IconTile";
import { ItemDrawerActions } from "@/components/items/ItemDrawerActions";
import { ItemDrawerDetails } from "@/components/items/ItemDrawerDetails";
import { ItemDrawerEditForm } from "@/components/items/ItemDrawerEditForm";
import { ItemDrawerSkeleton } from "@/components/items/ItemDrawerSkeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ItemDetailState } from "@/hooks/use-item-detail";
import { getLanguageLabel } from "@/lib/code-editor";
import { getItemCopyText } from "@/lib/item-copy";
import { getItemTypeLabel } from "@/lib/item-types";
import type { ItemDetail, ItemDrawerSummary } from "@/types/items";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean, details: Dialog.Root.ChangeEventDetails) => void;
  /** The card that was clicked. Null until the first item is opened. */
  summary: ItemDrawerSummary | null;
  detail: ItemDetailState;
  /** Takes the item a save returned, so the drawer shows it without a refetch. */
  onItemSaved: (item: ItemDetail) => void;
  /** Merges a saved toggle (favorite, pin) into the item on show. */
  onItemPatched: (id: string, changes: Partial<ItemDetail>) => void;
  /** Runs after the open item has been deleted. */
  onItemDeleted: () => void;
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
  onItemPatched,
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
            onItemPatched={onItemPatched}
            onItemDeleted={onItemDeleted}
          />
        </SheetContent>
      )}
    </Sheet>
  );
}

interface ItemDrawerPanelProps {
  summary: ItemDrawerSummary;
  detail: ItemDetailState;
  onItemSaved: (item: ItemDetail) => void;
  onItemPatched: (id: string, changes: Partial<ItemDetail>) => void;
  onItemDeleted: () => void;
}

/**
 * The sheet's contents, in view or edit mode. It sits inside the popup, which
 * unmounts once the sheet has closed, so edit mode and any unsaved changes
 * never carry over to the next item opened.
 */
function ItemDrawerPanel({
  summary,
  detail,
  onItemSaved,
  onItemPatched,
  onItemDeleted,
}: ItemDrawerPanelProps) {
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
            onFavoriteSaved={
              item ? (isFavorite) => onItemPatched(item.id, { isFavorite }) : undefined
            }
            onPinSaved={item ? (isPinned) => onItemPatched(item.id, { isPinned }) : undefined}
            isFavorite={current.isFavorite}
            isPinned={current.isPinned}
            copyText={item ? getItemCopyText(item) : null}
            onEdit={item ? () => setEditing(true) : undefined}
            focusEdit={focusEdit}
          />

          <div className="flex-1 overflow-y-auto p-6">
            <ItemDrawerBody detail={detail} onItemPatched={onItemPatched} />
          </div>
        </>
      )}
    </>
  );
}

function ItemDrawerBody({
  detail,
  onItemPatched,
}: Readonly<{ detail: ItemDetailState; onItemPatched: ItemDrawerPanelProps["onItemPatched"] }>) {
  if (detail.status === "ready") {
    return <ItemDrawerDetails item={detail.item} onContentSaved={onItemPatched} />;
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
  return (
    // Right padding clears the sheet's own close button.
    <div className="flex items-start gap-4 p-6 pr-14">
      <ItemTypeIconTile typeName={typeName} size="lg" />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SheetTitle className="text-xl font-semibold wrap-break-word">{title}</SheetTitle>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{getItemTypeLabel(typeName)}</Badge>
          {language && <Badge variant="outline">{getLanguageLabel(language)}</Badge>}
        </div>
      </div>
    </div>
  );
}
