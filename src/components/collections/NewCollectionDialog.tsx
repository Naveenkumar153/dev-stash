"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { COLLECTION_CREATE_FAILED } from "@/lib/action-result";

interface NewCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the control that opened it, as it has no trigger of its own. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

/**
 * The New Collection dialog, opened from the top bar's New menu. The form
 * mounts with the dialog's popup, so every open starts blank and closing
 * discards the draft. Escape and the backdrop can't dismiss it mid-create, so
 * the user always sees how it ended.
 */
export function NewCollectionDialog({
  open,
  onOpenChange,
  returnFocusRef,
}: Readonly<NewCollectionDialogProps>) {
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
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>Group related items of any type in one place.</DialogDescription>
        </DialogHeader>
        <CollectionForm
          submitLabel="Create"
          pendingLabel="Creating..."
          fallbackError={COLLECTION_CREATE_FAILED}
          pending={pending}
          startTransition={startTransition}
          onSubmit={createCollection}
          onSaved={() => {
            toast.success("Collection created");
            onOpenChange(false);
            // Re-renders the server components so the cards, stats and sidebar show it.
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
