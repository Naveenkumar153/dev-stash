"use client";

import { toast } from "sonner";

import { createCollection, updateCollection } from "@/actions/collections";
import { CollectionForm } from "@/components/collections/CollectionForm";
import { FormDialog } from "@/components/dialogs/FormDialog";
import { COLLECTION_CREATE_FAILED, COLLECTION_UPDATE_FAILED } from "@/lib/action-result";
import type { CollectionHeader } from "@/lib/db/collections";

interface CollectionFormDialogProps {
  /** The collection to edit; without one the dialog creates a new collection. */
  collection?: CollectionHeader;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close: the control that opened it, as it has no trigger of its own. */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

/**
 * New collection (from the top bar's New menu) or Edit collection (from a
 * collection page or a card's menu). Every open starts from the collection's
 * saved values, or blank for New. The actions re-render the cards, stats,
 * header and sidebar in their own response.
 */
export function CollectionFormDialog({
  collection,
  open,
  onOpenChange,
  returnFocusRef,
}: Readonly<CollectionFormDialogProps>) {
  const editing = collection !== undefined;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      finalFocus={returnFocusRef}
      title={editing ? "Edit collection" : "New collection"}
      description={
        editing
          ? "Change this collection's name and description."
          : "Group related items of any type in one place."
      }
    >
      {({ pending, startTransition, close }) => (
        <CollectionForm
          initialValues={collection}
          submitLabel={editing ? "Save" : "Create"}
          pendingLabel={editing ? "Saving..." : "Creating..."}
          fallbackError={editing ? COLLECTION_UPDATE_FAILED : COLLECTION_CREATE_FAILED}
          pending={pending}
          startTransition={startTransition}
          onSubmit={(values) =>
            editing ? updateCollection(collection.id, values) : createCollection(values)
          }
          onSaved={() => {
            toast.success(editing ? "Collection updated" : "Collection created");
            close();
          }}
        />
      )}
    </FormDialog>
  );
}
