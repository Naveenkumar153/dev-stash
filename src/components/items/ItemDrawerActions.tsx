"use client";

import { Copy, Pencil, Pin, Star } from "lucide-react";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { ItemDeleteDialog } from "@/components/items/ItemDeleteDialog";
import { PinToggle } from "@/components/items/PinToggle";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

/**
 * Favorite, Pin and Copy show only their icons in the full-width phone drawer,
 * so the bar fits one row; the label stays as the button's accessible name.
 */
const COMPACT_LABEL = "sr-only sm:not-sr-only";

interface ItemDrawerActionsProps {
  itemId: string;
  itemTitle: string;
  isFavorite: boolean;
  isPinned: boolean;
  /** What Copy puts on the clipboard. Null while loading, or when there is nothing to copy. */
  copyText: string | null;
  /** Switches the drawer to edit mode. Undefined until the full item has loaded. */
  onEdit?: () => void;
  /** Focuses Edit when the bar mounts, i.e. when the drawer comes back from edit mode. */
  focusEdit?: boolean;
  /** Delete waits for the full item, like Edit. */
  canDelete: boolean;
  /** Runs after the item has been deleted. */
  onDeleted: () => void;
  /**
   * Saves a favorite toggle into the drawer's copy of the item. Undefined until
   * the full item has loaded, which keeps Favorite disabled like Edit.
   */
  onFavoriteSaved?: (isFavorite: boolean) => void;
  /** Saves a pin toggle into the drawer's copy of the item, like `onFavoriteSaved`. */
  onPinSaved?: (isPinned: boolean) => void;
}

/**
 * The drawer's action bar: Favorite, Pin, Copy, Edit and Delete. Favorite and
 * Pin stay disabled, still showing the item's state, until the full item has
 * loaded.
 */
export function ItemDrawerActions({
  itemId,
  itemTitle,
  canDelete,
  onDeleted,
  onFavoriteSaved,
  onPinSaved,
  isFavorite,
  isPinned,
  copyText,
  onEdit,
  focusEdit = false,
}: ItemDrawerActionsProps) {
  function handleCopy() {
    if (copyText) {
      void copyToClipboard(copyText);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 pb-4">
      {onFavoriteSaved ? (
        <FavoriteToggle
          kind="item"
          id={itemId}
          name={itemTitle}
          isFavorite={isFavorite}
          onSaved={onFavoriteSaved}
          size="default"
          showLabel
          labelClassName={COMPACT_LABEL}
        />
      ) : (
        <Button
          variant="ghost"
          disabled
          aria-pressed={isFavorite}
          className={cn(isFavorite && "text-amber-400")}
        >
          <Star aria-hidden className={cn(isFavorite && "fill-amber-400")} />
          <span className={COMPACT_LABEL}>Favorite</span>
        </Button>
      )}

      {onPinSaved ? (
        <PinToggle
          itemId={itemId}
          isPinned={isPinned}
          onSaved={onPinSaved}
          labelClassName={COMPACT_LABEL}
        />
      ) : (
        <Button variant="ghost" disabled aria-pressed={isPinned}>
          <Pin aria-hidden className={cn(isPinned && "fill-current")} />
          <span className={COMPACT_LABEL}>Pin</span>
        </Button>
      )}

      <Button variant="ghost" disabled={!copyText} onClick={handleCopy}>
        <Copy aria-hidden />
        <span className={COMPACT_LABEL}>Copy</span>
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" disabled={!onEdit} onClick={onEdit} autoFocus={focusEdit}>
          <Pencil aria-hidden />
          Edit
        </Button>

        <ItemDeleteDialog
          itemId={itemId}
          itemTitle={itemTitle}
          enabled={canDelete}
          onDeleted={onDeleted}
        />
      </div>
    </div>
  );
}
