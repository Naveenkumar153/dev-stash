import { useId } from "react";

import { CodeEditor } from "@/components/items/CodeEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/auth-schemas";
import { parseTagInput, type UpdateItemInput } from "@/lib/item-schemas";
import type { EditableItemFields } from "@/lib/item-types";

/** The form's inputs, as typed. Tags stay one comma-separated string until Save. */
export interface ItemFormValues {
  title: string;
  description: string;
  content: string;
  language: string;
  url: string;
  tags: string;
}

/** Every input blank, for a new item. */
export const EMPTY_ITEM_FORM: ItemFormValues = {
  title: "",
  description: "",
  content: "",
  language: "",
  url: "",
  tags: "",
};

/**
 * The fields to send for an item of a type with these `fields`: title,
 * description and tags always, plus only the type's own fields.
 */
export function toItemInput(values: ItemFormValues, fields: EditableItemFields): UpdateItemInput {
  return {
    title: values.title,
    description: values.description,
    tags: parseTagInput(values.tags),
    ...(fields.content && { content: values.content }),
    ...(fields.language && { language: values.language }),
    ...(fields.url && { url: values.url }),
  };
}

interface ItemFormFieldsProps {
  values: ItemFormValues;
  errors: FieldErrors;
  fields: EditableItemFields;
  /** Edits the content in the code editor rather than a textarea. */
  codeContent: boolean;
  onChange: (name: keyof ItemFormValues, value: string) => void;
}

/** Title, description and tags for every type, plus the type's own fields. */
export function ItemFormFields({
  values,
  errors,
  fields,
  codeContent,
  onChange,
}: ItemFormFieldsProps) {
  const id = useId();
  const field = (name: keyof ItemFormValues) => ({ id: `${id}-${name}`, error: errors[name] });
  const bind = (name: keyof ItemFormValues) => ({
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
          {(control) =>
            codeContent ? (
              <CodeEditor
                value={values.content}
                language={values.language}
                onChange={(value) => onChange("content", value)}
                ariaLabel="Content"
                invalid={control["aria-invalid"]}
              />
            ) : (
              <Textarea
                {...control}
                {...bind("content")}
                spellCheck={false}
                className="min-h-40 font-mono text-[13px] leading-relaxed"
              />
            )
          }
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
