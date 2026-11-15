"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import { EditCollectionDialog } from "@/components/collections/EditCollectionDialog";
import { FavoriteCollectionButton } from "@/components/collections/FavoriteCollectionButton";
import { Button } from "@/components/ui/button";
import type { CollectionHeader } from "@/lib/db/collections";

/**
 * The collection page's Favorite, Edit and Delete buttons. Edit and Delete
 * text hides on phones, leaving the icons with their labels. After a delete
 * the page has nothing to show, so it goes back to the list.
 */
export function CollectionActions({ collection }: Readonly<{ collection: CollectionHeader }>) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRef = useRef<HTMLButtonElement>(null);
  const deleteRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <FavoriteCollectionButton isFavorite={collection.isFavorite} />
      <Button
        ref={editRef}
        variant="outline"
        aria-label="Edit collection"
        onClick={() => setEditOpen(true)}
      >
        <Pencil aria-hidden />
        <span className="hidden sm:inline">Edit</span>
      </Button>
      <Button
        ref={deleteRef}
        variant="outline"
        aria-label="Delete collection"
        className="text-destructive"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 aria-hidden />
        <span className="hidden sm:inline">Delete</span>
      </Button>

      <EditCollectionDialog
        collection={collection}
        open={editOpen}
        onOpenChange={setEditOpen}
        returnFocusRef={editRef}
      />
      <DeleteCollectionDialog
        collection={collection}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        returnFocusRef={deleteRef}
        // The action already refreshed the layout; the page itself is gone.
        onDeleted={() => router.replace("/collections")}
      />
    </div>
  );
}
