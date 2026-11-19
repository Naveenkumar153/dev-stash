import { useId } from "react";

import { CodeEditor } from "@/components/items/CodeEditor";
import { CollectionPicker } from "@/components/items/CollectionPicker";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCollectionOptions, type CollectionOptionsState } from "@/hooks/use-collection-options";
import type { FieldErrors } from "@/lib/action-result";
import type { UpdateItemInput } from "@/lib/item-schemas";
import { parseTagInput } from "@/lib/tags";
import type { ContentEditorKind, EditableItemFields } from "@/lib/item-types";
import type { CollectionOption } from "@/types/collections";
import { ITEM_LIMITS } from "@/lib/item-limits";

/**
 * The form's inputs, as typed. Tags stay one comma-separated string until
 * Save; collections are kept with their names so the chips can show them.
 */
export interface ItemFormValues {
  title: string;
  description: string;
  content: string;
  language: string;
  url: string;
  tags: string;
  collections: CollectionOption[];
}

/** The inputs that hold plain text. */
type TextFieldName = Exclude<keyof ItemFormValues, "collections">;

/** Sets one input's value; the value's type follows the field. */
export type ItemFormChange = <K extends keyof ItemFormValues>(
  name: K,
  value: ItemFormValues[K],
) => void;

/** Every input blank, for a new item. */
export const EMPTY_ITEM_FORM: ItemFormValues = {
  title: "",
  description: "",
  content: "",
  language: "",
  url: "",
  tags: "",
  collections: [],
};

/**
 * The fields to send for an item of a type with these `fields`: title,
 * description, tags and collections always, plus only the type's own fields.
 */
export function toItemInput(values: ItemFormValues, fields: EditableItemFields): UpdateItemInput {
  return {
    title: values.title,
    description: values.description,
    tags: parseTagInput(values.tags),
    collectionIds: values.collections.map((collection) => collection.id),
    ...(fields.content && { content: values.content }),
    ...(fields.language && { language: values.language }),
    ...(fields.url && { url: values.url }),
  };
}

interface ItemFormFieldsProps {
  values: ItemFormValues;
  errors: FieldErrors;
  fields: EditableItemFields;
  /** Which editor the content field uses: code, markdown or a plain textarea. */
  contentEditor: ContentEditorKind;
  onChange: ItemFormChange;
}

/**
 * Title, description, tags and collections for every type, plus the type's own
 * fields. The user's collections are loaded when the fields mount.
 */
export function ItemFormFields({
  values,
  errors,
  fields,
  contentEditor,
  onChange,
}: ItemFormFieldsProps) {
  const id = useId();
  const collectionOptions = useCollectionOptions();
  const field = (name: keyof ItemFormValues) => ({ id: `${id}-${name}`, error: errors[name] });
  const bind = (name: TextFieldName) => ({
    value: values[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(name, event.target.value),
  });

  return (
    <div className="flex flex-col gap-5">
      <Field {...field("title")} label="Title">
        {(control) => (
          <Input {...control} {...bind("title")} required autoFocus maxLength={ITEM_LIMITS.title} />
        )}
      </Field>

      <Field {...field("description")} label="Description">
        {(control) => (
          <Textarea
            {...control}
            {...bind("description")}
            maxLength={ITEM_LIMITS.description}
            className="min-h-20"
          />
        )}
      </Field>

      {fields.content && (
        <Field {...field("content")} label="Content">
          {(control) => {
            if (contentEditor === "code") {
              return (
                <CodeEditor
                  value={values.content}
                  language={values.language}
                  onChange={(value) => onChange("content", value)}
                  ariaLabel="Content"
                  invalid={control["aria-invalid"]}
                />
              );
            }

            if (contentEditor === "markdown") {
              return (
                <MarkdownEditor
                  id={control.id}
                  describedBy={control["aria-describedby"]}
                  value={values.content}
                  onChange={(value) => onChange("content", value)}
                  ariaLabel="Content"
                  invalid={control["aria-invalid"]}
                />
              );
            }

            return (
              <Textarea
                {...control}
                {...bind("content")}
                spellCheck={false}
                className="min-h-40 font-mono text-[13px] leading-relaxed"
              />
            );
          }}
        </Field>
      )}

      {fields.language && (
        <Field {...field("language")} label="Language">
          {(control) => (
            <Input
              {...control}
              {...bind("language")}
              placeholder="typescript"
              spellCheck={false}
              maxLength={ITEM_LIMITS.language}
            />
          )}
        </Field>
      )}

      {fields.url && (
        <Field {...field("url")} label="URL">
          {(control) => (
            <Input
              {...control}
              {...bind("url")}
              type="url"
              placeholder="https://"
              spellCheck={false}
              maxLength={ITEM_LIMITS.url}
            />
          )}
        </Field>
      )}

      <Field {...field("tags")} label="Tags" hint="Separate tags with commas">
        {(control) => <Input {...control} {...bind("tags")} placeholder="react, hooks" />}
      </Field>

      <Field
        id={`${id}-collections`}
        error={errors.collectionIds}
        label="Collections"
        hint={getCollectionsHint(collectionOptions)}
      >
        {(control) => (
          <CollectionPicker
            {...control}
            options={collectionOptions}
            value={values.collections}
            onChange={(value) => onChange("collections", value)}
          />
        )}
      </Field>
    </div>
  );
}

/** What the Collections field says under the picker while it loads, fails or has nothing to list. */
function getCollectionsHint(options: CollectionOptionsState): string | undefined {
  if (options.status === "loading") {
    return "Loading your collections...";
  }
  if (options.status === "error") {
    return options.message;
  }
  if (options.collections.length === 0) {
    return "No collections yet. Create one with New Collection.";
  }
  return undefined;
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
