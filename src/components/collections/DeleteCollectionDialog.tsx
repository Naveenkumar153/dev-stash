"use client";

import { deleteCollection } from "@/actions/collections";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { COLLECTION_DELETE_FAILED } from "@/lib/action-result";
import type { CollectionHeader } from "@/lib/db/collections";

interface DeleteCollectionDialogProps {
  collection: CollectionHeader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the button that opened it, as it has no trigger of its own. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
  /**
   * Runs after a successful delete, e.g. to leave the deleted collection's
   * page. The action itself refreshes the page, cards and sidebar.
   */
  onDeleted?: () => void;
}

/** Confirms deleting a collection. Its items are kept; they only leave the collection. */
export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  returnFocusRef,
  onDeleted,
}: Readonly<DeleteCollectionDialogProps>) {
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={returnFocusRef}
      title={<>Delete &ldquo;{collection.name}&rdquo;?</>}
      description="The collection is deleted, but its items are kept. They just won't be in this collection anymore. This can't be undone."
      onConfirm={() => deleteCollection(collection.id)}
      failedMessage={COLLECTION_DELETE_FAILED}
      successMessage="Collection deleted"
      onDeleted={onDeleted}
    />
  );
}
