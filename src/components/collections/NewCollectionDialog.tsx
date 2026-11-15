"use client";

import { FolderPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { COLLECTION_CREATE_FAILED } from "@/lib/action-result";

/**
 * The top bar's New Collection button and the dialog it opens. The form mounts
 * with the dialog's popup, so every open starts blank and closing discards the
 * draft. Escape and the backdrop can't dismiss it mid-create, so the user
 * always sees how it ended.
 */
export function NewCollectionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* The text hides on phones, so the label carries the name. */}
      <DialogTrigger render={<Button variant="outline" size="lg" aria-label="New collection" />}>
        <FolderPlus aria-hidden />
        <span className="hidden sm:inline">New Collection</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0">
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
            setOpen(false);
            // Re-renders the server components so the cards, stats and sidebar show it.
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
