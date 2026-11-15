"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLLECTION_UPDATE_FAILED } from "@/lib/action-result";
import type { CollectionHeader } from "@/lib/db/collections";

interface EditCollectionDialogProps {
  collection: CollectionHeader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the button that opened it, as it has no trigger of its own. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

/**
 * Edits a collection's name and description, opened from the collection
 * page's Edit button or a card's menu. The form mounts with the popup, so
 * every open starts from the collection's saved values. It can't be dismissed
 * mid-save.
 */
export function EditCollectionDialog({
  collection,
  open,
  onOpenChange,
  returnFocusRef,
}: Readonly<EditCollectionDialogProps>) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        finalFocus={returnFocusRef}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0"
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>Change this collection&apos;s name and description.</DialogDescription>
        </DialogHeader>
        <CollectionForm
          initialValues={collection}
          submitLabel="Save"
          pendingLabel="Saving..."
          fallbackError={COLLECTION_UPDATE_FAILED}
          pending={pending}
          startTransition={startTransition}
          onSubmit={(values) => updateCollection(collection.id, values)}
          onSaved={() => {
            toast.success("Collection updated");
            onOpenChange(false);
            // The page header, cards and sidebar all read the name.
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
