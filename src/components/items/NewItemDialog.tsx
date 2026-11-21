"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { FormDialog } from "@/components/dialogs/FormDialog";
import { NewItemForm } from "@/components/items/NewItemForm";
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

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={returnFocusRef}
      className="sm:max-w-lg"
      title="New item"
      description="Save a snippet, prompt, command, note, link, file or image."
    >
      {({ pending, startTransition, close }) => (
        <NewItemForm
          defaultType={defaultType ?? getCreatableTypeFromPath(pathname) ?? "snippet"}
          folderId={folderId !== undefined ? folderId : getOpenFolderId(pathname, searchParams)}
          pending={pending}
          startTransition={startTransition}
          onCreated={close}
        />
      )}
    </FormDialog>
  );
}
