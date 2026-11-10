"use client";

import { Copy, Pencil, Pin, Star } from "lucide-react";
import { toast } from "sonner";

import { ItemDeleteDialog } from "@/components/items/ItemDeleteDialog";
import { Button } from "@/components/ui/button";
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
}

/**
 * The drawer's action bar. Copy, Edit and Delete work; favoriting and pinning
 * come with their own features, so until then those buttons are disabled rather
 * than doing nothing when clicked. Favorite and Pin still show the item's
 * current state.
 */
export function ItemDrawerActions({
  itemId,
  itemTitle,
  canDelete,
  onDeleted,
  isFavorite,
  isPinned,
  copyText,
  onEdit,
  focusEdit = false,
}: ItemDrawerActionsProps) {
  async function handleCopy() {
    if (!copyText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyText);
      toast.success("Copied to clipboard");
    } catch {
      // No clipboard access: an insecure origin or a denied permission.
      toast.error("Couldn't copy to the clipboard.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 pb-4">
      <Button
        variant="ghost"
        disabled
        aria-pressed={isFavorite}
        className={cn(isFavorite && "text-amber-400")}
      >
        <Star aria-hidden className={cn(isFavorite && "fill-amber-400")} />
        Favorite
      </Button>

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
