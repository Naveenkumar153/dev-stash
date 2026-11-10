"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type TransitionStartFunction } from "react";
import { toast } from "sonner";

import { createItem } from "@/actions/items";
import {
  EMPTY_ITEM_FORM,
  ItemFormFields,
  toItemInput,
  type ItemFormValues,
} from "@/components/items/ItemFormFields";
import { ItemTypeSelector } from "@/components/items/ItemTypeSelector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FieldErrors } from "@/lib/auth-schemas";
import { getEditableItemFields, type CreatableItemType } from "@/lib/item-types";

const CREATE_FAILED = "Couldn't create this item. Please try again.";

/**
 * The top bar's New Item button and the dialog it opens. The form mounts with
 * the dialog's popup, so every open starts blank and closing discards the draft.
 */
export function NewItemDialog() {
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
      <DialogTrigger render={<Button size="lg" aria-label="New item" />}>
        <Plus aria-hidden />
        <span className="hidden sm:inline">New Item</span>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>Save a snippet, prompt, command, note or link.</DialogDescription>
        </DialogHeader>
        <NewItemForm
          pending={pending}
          startTransition={startTransition}
          onCreated={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface NewItemFormProps {
  pending: boolean;
  /** The dialog's transition, so it knows not to close while the create runs. */
  startTransition: TransitionStartFunction;
  onCreated: () => void;
}

/** The type picker, the fields that type uses, and Create / Cancel. */
function NewItemForm({ pending, startTransition, onCreated }: NewItemFormProps) {
  const router = useRouter();
  const [typeName, setTypeName] = useState<CreatableItemType>("snippet");
  const [values, setValues] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const fields = getEditableItemFields(typeName);

  function handleChange(name: keyof ItemFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleTypeChange(next: CreatableItemType) {
    setTypeName(next);
    // Errors for fields the new type hides would otherwise linger unseen.
    setFieldErrors({});
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createItem({ ...toItemInput(values, fields), typeName });
      if (result.success) {
        toast.success("Item created");
        onCreated();
        // Re-renders the server components so the lists, stats and counts show it.
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors);
      toast.error(result.error ?? CREATE_FAILED);
    });
  }

  return (
    // noValidate: the server action's schema is the source of truth for errors.
    <form onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-5 px-6 pb-6">
        <ItemTypeSelector value={typeName} onChange={handleTypeChange} disabled={pending} />
        <ItemFormFields
          values={values}
          errors={fieldErrors}
          fields={fields}
          onChange={handleChange}
        />
      </div>

      <DialogFooter className="mx-0 mb-0 px-6">
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending || !values.title.trim()}>
          {pending ? "Creating..." : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}
