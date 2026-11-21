"use client";

import { useState } from "react";

import { CollectionFormDialog } from "@/components/collections/CollectionFormDialog";
import { DeleteCollectionDialog } from "@/components/collections/DeleteCollectionDialog";
import type { CollectionHeader } from "@/lib/db/collections";

type CollectionDialog = "edit" | "delete" | null;

/** Which of a collection's Edit / Delete dialogs is open, for the controls that open them. */
export function useCollectionDialogs() {
  const [dialog, setDialog] = useState<CollectionDialog>(null);

  return {
    dialog,
    openEdit: () => setDialog("edit"),
    openDelete: () => setDialog("delete"),
    close: () => setDialog(null),
  };
}

interface CollectionDialogsProps {
  collection: CollectionHeader;
  dialog: CollectionDialog;
  onClose: () => void;
  /** Where focus returns when Edit closes. */
  editFocusRef: React.RefObject<HTMLElement | null>;
  /** Where focus returns when Delete closes; defaults to `editFocusRef`. */
  deleteFocusRef?: React.RefObject<HTMLElement | null>;
  /** Runs after a successful delete. */
  onDeleted?: () => void;
}

/**
 * A collection's Edit and Delete dialogs, rendered outside the buttons or menu
 * that open them so they stay open after a menu closes.
 */
export function CollectionDialogs({
  collection,
  dialog,
  onClose,
  editFocusRef,
  deleteFocusRef = editFocusRef,
  onDeleted,
}: Readonly<CollectionDialogsProps>) {
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <>
      <CollectionFormDialog
        collection={collection}
        open={dialog === "edit"}
        onOpenChange={handleOpenChange}
        returnFocusRef={editFocusRef}
      />
      <DeleteCollectionDialog
        collection={collection}
        open={dialog === "delete"}
        onOpenChange={handleOpenChange}
        returnFocusRef={deleteFocusRef}
        onDeleted={onDeleted}
      />
    </>
  );
}
