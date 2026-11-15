"use client";

import { Copy, Pencil, Pin, Star } from "lucide-react";

import { FavoriteToggle } from "@/components/favorites/FavoriteToggle";
import { ItemDeleteDialog } from "@/components/items/ItemDeleteDialog";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

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
}

/**
 * The drawer's action bar. Favorite, Copy, Edit and Delete work; pinning comes
 * with its own feature, so until then Pin is disabled rather than doing nothing
 * when clicked, while still showing the item's state.
 */
export function ItemDrawerActions({
  itemId,
  itemTitle,
  canDelete,
  onDeleted,
  onFavoriteSaved,
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
        />
      ) : (
        <Button
          variant="ghost"
          disabled
          aria-pressed={isFavorite}
          className={cn(isFavorite && "text-amber-400")}
        >
          <Star aria-hidden className={cn(isFavorite && "fill-amber-400")} />
          Favorite
        </Button>
      )}

      <Button variant="ghost" disabled aria-pressed={isPinned}>
        <Pin aria-hidden className={cn(isPinned && "fill-current")} />
        Pin
      </Button>

      <Button variant="ghost" disabled={!copyText} onClick={handleCopy}>
        <Copy aria-hidden />
        Copy
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
