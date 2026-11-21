"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteItem } from "@/actions/items";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ITEM_DELETE_FAILED } from "@/lib/action-result";

interface ItemDeleteDialogProps {
  itemId: string;
  itemTitle: string;
  /** False until the full item has loaded, which keeps the trash button disabled. */
  enabled: boolean;
  /** Runs after a successful delete, e.g. to close the drawer. */
  onDeleted: () => void;
}

/** The drawer's trash button and the confirmation behind it. */
export function ItemDeleteDialog({ itemId, itemTitle, enabled, onDeleted }: ItemDeleteDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
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
      }
      title={<>Delete &ldquo;{itemTitle}&rdquo;?</>}
      description="This permanently deletes the item and removes it from its collections. It can't be undone."
      onConfirm={() => deleteItem(itemId)}
      failedMessage={ITEM_DELETE_FAILED}
      successMessage="Item deleted"
      // deleteItem re-renders the lists and counts in its own response.
      onDeleted={onDeleted}
    />
  );
}
