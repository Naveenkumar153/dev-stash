"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { NewItemForm } from "@/components/items/NewItemForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getOpenFolderId } from "@/lib/folders";
import { getCreatableTypeFromPath, type CreatableItemType } from "@/lib/item-types";

interface NewItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the control that opened it, as it has no trigger of its own. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
  /**
   * The type the form starts on, as on a type's list page. Without it the form
   * starts on the type of the list page it's shown over, else snippet.
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
 * The New Item dialog, opened by the top bar's New menu or a list page's
 * `NewItemButton`. The form mounts with the dialog's popup, so every open
 * starts blank and closing discards the draft.
 */
export function NewItemDialog({
  open,
  onOpenChange,
  returnFocusRef,
  defaultType,
  folderId,
}: Readonly<NewItemDialogProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Escape and the backdrop can't dismiss the dialog mid-create, so the user
  // always sees how it ended.
  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        finalFocus={returnFocusRef}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Save a snippet, prompt, command, note, link, file or image.</DialogDescription>
        </DialogHeader>
        <NewItemForm
          defaultType={defaultType ?? getCreatableTypeFromPath(pathname) ?? "snippet"}
          folderId={folderId !== undefined ? folderId : getOpenFolderId(pathname, searchParams)}
          pending={pending}
          startTransition={startTransition}
          onCreated={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
