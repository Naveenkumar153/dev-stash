"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog } from "@/components/collections/EditCollectionDialog";
import { RowActionsMenu } from "@/components/items/RowActionsMenu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import type { CollectionHeader } from "@/lib/db/collections";

/**
 * A collection card's "more actions" menu: Edit, Favorite (shown but disabled
 * until favoriting is built) and Delete. The trigger sits above the card's
 * stretched link, so it opens the menu without navigating. The dialogs live
 * outside the menu, so they stay open after it closes.
 */
export function CollectionCardMenu({ collection }: Readonly<{ collection: CollectionHeader }>) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <RowActionsMenu label={`Actions for ${collection.name}`} triggerRef={triggerRef}>
        <DropdownMenuItem onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <Star aria-hidden />
          {collection.isFavorite ? "Unfavorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </RowActionsMenu>

      <EditCollectionDialog
        collection={collection}
        open={editOpen}
        onOpenChange={setEditOpen}
        returnFocusRef={triggerRef}
      />
      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
