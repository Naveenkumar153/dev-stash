"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import { useRef } from "react";

import { setCollectionFavorite } from "@/actions/collections";
import {
  CollectionDialogs,
  useCollectionDialogs,
} from "@/components/collections/CollectionDialogs";
import { RowActionsMenu } from "@/components/items/RowActionsMenu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import type { CollectionHeader } from "@/lib/db/collections";

/**
 * A collection card's "more actions" menu: Edit, Favorite / Unfavorite and
 * Delete. The trigger sits above the card's
 * stretched link, so it opens the menu without navigating. The dialogs live
 * outside the menu, so they stay open after it closes.
 */
export function CollectionCardMenu({ collection }: Readonly<{ collection: CollectionHeader }>) {
  const dialogs = useCollectionDialogs();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const favorite = useFavoriteToggle(collection.isFavorite, (next) =>
    setCollectionFavorite(collection.id, next),
  );

  return (
    <>
      <RowActionsMenu label={`Actions for ${collection.name}`} triggerRef={triggerRef}>
        <DropdownMenuItem onClick={dialogs.openEdit}>
          <Pencil aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={favorite.toggle}>
          <Star aria-hidden />
          {favorite.isFavorite ? "Unfavorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={dialogs.openDelete}>
          <Trash2 aria-hidden />
          Delete
        </DropdownMenuItem>
      </RowActionsMenu>

      <CollectionDialogs
        collection={collection}
        dialog={dialogs.dialog}
        onClose={dialogs.close}
        editFocusRef={triggerRef}
      />
    </>
  );
}
