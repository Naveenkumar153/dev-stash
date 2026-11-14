"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { ItemCollectionsSection, ItemDatesSection } from "@/components/items/ItemDrawerDetails";
import {
  ItemFormFields,
  toItemInput,
  type ItemFormValues,
} from "@/components/items/ItemFormFields";
import { Button } from "@/components/ui/button";
import type { FieldErrors } from "@/lib/auth-schemas";
import { getContentEditorKind, getEditableItemFields } from "@/lib/item-types";
import type { ItemDetail } from "@/types/items";

function toFormValues(item: ItemDetail): ItemFormValues {
  return {
    title: item.title,
    description: item.description ?? "",
    content: item.content ?? "",
    language: item.language ?? "",
    url: item.url ?? "",
    tags: item.tags.join(", "),
  };
}

interface ItemDrawerEditFormProps {
  item: ItemDetail;
  onCancel: () => void;
  /** Takes the saved item, so the drawer can show it without a refetch. */
  onSaved: (item: ItemDetail) => void;
}

/**
 * Edit mode: Save and Cancel take the action bar's place and the editable
 * fields replace the body. The inputs live in local state, so Cancel simply
 * drops them. Type, collections and dates stay display-only.
 */
export function ItemDrawerEditForm({ item, onCancel, onSaved }: ItemDrawerEditFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(() => toFormValues(item));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();
  const fields = getEditableItemFields(item.typeName);

  function handleChange(name: keyof ItemFormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateItem(item.id, toItemInput(values, fields));
      if (result.success && result.data) {
        toast.success("Item saved");
        onSaved(result.data);
        // Re-renders the server components so the cards behind show the edit.
        router.refresh();
        return;
      }

      setFieldErrors(result.fieldErrors);
      toast.error(result.error ?? "Couldn't save your changes. Please try again.");
    });
  }

  return (
    // noValidate: the server action's schema is the source of truth for errors.
    <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-4 pb-4">
        <Button type="submit" disabled={pending || !values.title.trim()}>
          <Check aria-hidden />
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          <X aria-hidden />
          Cancel
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
        <ItemFormFields
          values={values}
          errors={fieldErrors}
          fields={fields}
          contentEditor={getContentEditorKind(item.typeName)}
          onChange={handleChange}
        />
        <ItemCollectionsSection collections={item.collections} />
        <ItemDatesSection createdAt={item.createdAt} updatedAt={item.updatedAt} />
      </div>
    </form>
  );
}
