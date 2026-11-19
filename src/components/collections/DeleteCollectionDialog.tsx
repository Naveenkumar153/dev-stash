"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteCollection } from "@/actions/collections";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { COLLECTION_DELETE_FAILED } from "@/lib/action-result";
import type { CollectionHeader } from "@/lib/db/collections";
import { callAction } from "@/lib/action-call";

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

/**
 * Confirms deleting a collection. Its items are kept; they only leave the
 * collection. A failure is toasted and leaves the dialog open, and it can't
 * be dismissed mid-delete.
 */
export function DeleteCollectionDialog({
  collection,
  open,
  onOpenChange,
  returnFocusRef,
  onDeleted,
}: Readonly<DeleteCollectionDialogProps>) {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await callAction(() => deleteCollection(collection.id));
      if (!result) {
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? COLLECTION_DELETE_FAILED);
        return;
      }

      onOpenChange(false);
      toast.success("Collection deleted");
      onDeleted?.();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent finalFocus={returnFocusRef}>
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-anywhere">
            Delete &ldquo;{collection.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The collection is deleted, but its items are kept. They just won&apos;t be in this
            collection anymore. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
