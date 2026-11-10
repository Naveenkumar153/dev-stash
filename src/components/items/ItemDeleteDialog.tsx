"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteItem } from "@/actions/items";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ItemDeleteDialogProps {
  itemId: string;
  itemTitle: string;
  /** False until the full item has loaded, which keeps the trash button disabled. */
  enabled: boolean;
  /** Runs after a successful delete, e.g. to close the drawer. */
  onDeleted: () => void;
}

/**
 * The drawer's trash button and the confirmation behind it. Nothing is deleted
 * until the user confirms; a failure is toasted and leaves the dialog open so
 * they can retry or cancel.
 */
export function ItemDeleteDialog({ itemId, itemTitle, enabled, onDeleted }: ItemDeleteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Escape and the backdrop can't dismiss the dialog mid-delete, so the user
  // always sees how it ended.
  function handleOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteItem(itemId);

      if (!result.success) {
        toast.error(result.error ?? "Couldn't delete this item. Please try again.");
        return;
      }

      setOpen(false);
      toast.success("Item deleted");
      onDeleted();
      // Removes the card from the lists and updates the counts.
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        disabled={!enabled}
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            className="text-destructive"
          />
        }
      >
        <Trash2 aria-hidden />
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-break-word">
            Delete &ldquo;{itemTitle}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the item and removes it from its collections. It
            can&apos;t be undone.
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
