"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateItem } from "@/actions/items";
import { ItemCollectionsSection, ItemDatesSection } from "@/components/items/ItemDrawerDetails";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/auth-schemas";
import { parseTagInput, type UpdateItemInput } from "@/lib/item-schemas";
import { getEditableItemFields, type EditableItemFields } from "@/lib/item-types";
import type { ItemDetail } from "@/types/items";

/** The form's inputs, as typed. Tags stay one comma-separated string until Save. */
interface FormValues {
  title: string;
  description: string;
  content: string;
  language: string;
  url: string;
  tags: string;
}

function toFormValues(item: ItemDetail): FormValues {
  return {
    title: item.title,
    description: item.description ?? "",
    content: item.content ?? "",
    language: item.language ?? "",
    url: item.url ?? "",
    tags: item.tags.join(", "),
  };
}

/** The payload for `updateItem`, with only the fields this item's type edits. */
function toUpdateInput(values: FormValues, fields: EditableItemFields): UpdateItemInput {
  return {
    title: values.title,
    description: values.description,
    tags: parseTagInput(values.tags),
    ...(fields.content && { content: values.content }),
    ...(fields.language && { language: values.language }),
    ...(fields.url && { url: values.url }),
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

  function handleChange(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      const result = await updateItem(item.id, toUpdateInput(values, fields));
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
        <ItemEditFields
          values={values}
          errors={fieldErrors}
          fields={fields}
          onChange={handleChange}
        />
        <ItemCollectionsSection collections={item.collections} />
        <ItemDatesSection createdAt={item.createdAt} updatedAt={item.updatedAt} />
      </div>
    </form>
  );
}

interface ItemEditFieldsProps {
  values: FormValues;
  errors: FieldErrors;
  fields: EditableItemFields;
  onChange: (name: keyof FormValues, value: string) => void;
}

/** Title, description and tags for every type, plus the type's own fields. */
function ItemEditFields({ values, errors, fields, onChange }: ItemEditFieldsProps) {
  const id = useId();
  const field = (name: keyof FormValues) => ({ id: `${id}-${name}`, error: errors[name] });
  const bind = (name: keyof FormValues) => ({
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(name, event.target.value),
  });

  return (
    <div className="flex flex-col gap-5">
      <Field {...field("title")} label="Title">
        {(control) => <Input {...control} {...bind("title")} required autoFocus />}
      </Field>

      <Field {...field("description")} label="Description">
        {(control) => <Textarea {...control} {...bind("description")} className="min-h-20" />}
      </Field>

      {fields.content && (
        <Field {...field("content")} label="Content">
          {(control) => (
            <Textarea
              {...control}
              {...bind("content")}
              spellCheck={false}
              className="min-h-40 font-mono text-[13px] leading-relaxed"
            />
          )}
        </Field>
      )}

      {fields.language && (
        <Field {...field("language")} label="Language">
          {(control) => (
            <Input {...control} {...bind("language")} placeholder="typescript" spellCheck={false} />
          )}
        </Field>
      )}

      {fields.url && (
        <Field {...field("url")} label="URL">
          {(control) => (
            <Input {...control} {...bind("url")} type="url" placeholder="https://" spellCheck={false} />
          )}
        </Field>
      )}

      <Field {...field("tags")} label="Tags" hint="Separate tags with commas">
        {(control) => <Input {...control} {...bind("tags")} placeholder="react, hooks" />}
      </Field>
    </div>
  );
}

interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Renders the control, given the props that tie it to the label, hint and error. */
  children: (control: FieldControlProps) => React.ReactNode;
}

/** A labelled control with its hint and validation message wired up for screen readers. */
function Field({ id, label, error, hint, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
