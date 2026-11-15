"use client";

import { Plus } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { NewItemForm } from "@/components/items/NewItemForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getOpenFolderId } from "@/lib/folders";
import { getCreatableTypeFromPath, getItemTypeLabel, type CreatableItemType } from "@/lib/item-types";

interface NewItemDialogProps {
  /**
   * The type the form starts on, which also names the button ("New Note"), as
   * on a type's list page. Without it the button is the top bar's generic one,
   * which starts on the type of the list page it's shown over, else snippet.
   */
  defaultType?: CreatableItemType;
  /**
   * The folder a new file goes in, null for the top level. Without it the
   * folder open on the files page is used, so the top bar's button uploads
   * where the user is looking. Ignored for every other type, since only files
   * go in folders.
   */
  folderId?: string | null;
}

/**
 * A New Item button and the dialog it opens. The form mounts with the dialog's
 * popup, so every open starts blank and closing discards the draft.
 */
export function NewItemDialog({ defaultType, folderId }: NewItemDialogProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Escape and the backdrop can't dismiss the dialog mid-create, so the user
  // always sees how it ended.
  function handleOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {defaultType ? (
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden />
          New {getItemTypeLabel(defaultType)}
        </DialogTrigger>
      ) : (
        // The text hides on phones, so the label carries the name.
        <DialogTrigger render={<Button size="lg" aria-label="New item" />}>
          <Plus aria-hidden />
          <span className="hidden sm:inline">New Item</span>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Save a snippet, prompt, command, note, link, file or image.</DialogDescription>
        </DialogHeader>
        <NewItemForm
          defaultType={defaultType ?? getCreatableTypeFromPath(pathname) ?? "snippet"}
          folderId={folderId !== undefined ? folderId : getOpenFolderId(pathname, searchParams)}
          pending={pending}
          startTransition={startTransition}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
