import { useId } from "react";
import { toast } from "sonner";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { CodeEditor } from "@/components/items/CodeEditor";
import { CollectionPicker } from "@/components/items/CollectionPicker";
import { GenerateDescriptionButton } from "@/components/items/GenerateDescriptionButton";
import { LanguageSelect } from "@/components/items/LanguageSelect";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { SuggestTagsButton, TagSuggestionList } from "@/components/items/TagSuggestions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAiDescription } from "@/hooks/use-ai-description";
import { useAutoTags } from "@/hooks/use-auto-tags";
import { useCollectionOptions, type CollectionOptionsState } from "@/hooks/use-collection-options";
import type { FieldErrors } from "@/lib/action-result";
import { hasAiInput, type AiItemDraft } from "@/lib/ai-item";
import type { UpdateItemInput } from "@/lib/item-schemas";
import { addTagToInput, parseTagInput } from "@/lib/tags";
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
  /** The item's type, sent with the draft to the AI buttons. */
  typeName: string;
  /** A file or image item's file name (picked or saved), which the AI buttons also read. */
  fileName?: string | null;
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
  typeName,
  fileName,
  values,
  errors,
  fields,
  contentEditor,
  onChange,
}: ItemFormFieldsProps) {
  const id = useId();
  const collectionOptions = useCollectionOptions();
  const hasProAccess = useProAccess();
  const autoTags = useAutoTags();
  const aiDescription = useAiDescription((description) => onChange("description", description));
  const aiDraft = toAiDraft(typeName, values, fields, fileName);
  const canUseAi = hasAiInput(aiDraft);
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

      <Field
        {...field("description")}
        label="Description"
        labelAside={
          hasProAccess && (
            <GenerateDescriptionButton
              pending={aiDescription.pending}
              canGenerate={canUseAi}
              onClick={() => aiDescription.generate(aiDraft)}
            />
          )
        }
      >
        {(control) => (
          <Textarea
            {...control}
            {...bind("description")}
            maxLength={ITEM_LIMITS.description}
            className="min-h-20"
          />
        )}
      </Field>

      {fields.language && (
        <Field {...field("language")} label="Language">
          {(control) => (
            <LanguageSelect
              {...control}
              value={values.language}
              onChange={(value) => onChange("language", value)}
            />
          )}
        </Field>
      )}

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

      <Field
        {...field("tags")}
        label="Tags"
        hint="Separate tags with commas"
        labelAside={
          hasProAccess && (
            <SuggestTagsButton
              pending={autoTags.pending}
              canSuggest={canUseAi}
              onClick={() => autoTags.suggest(aiDraft)}
            />
          )
        }
      >
        {(control) => (
          <>
            <Input {...control} {...bind("tags")} placeholder="react, hooks" />
            <TagSuggestionList
              suggestions={autoTags.suggestions}
              onAccept={(tag) => {
                const next = addTagToInput(values.tags, tag);
                // A tag already in the input adds nothing, so only a new one can hit the cap.
                if (next !== values.tags && parseTagInput(values.tags).length >= ITEM_LIMITS.tagCount) {
                  toast.error(`Add up to ${ITEM_LIMITS.tagCount} tags`);
                  return;
                }
                onChange("tags", next);
                autoTags.remove(tag);
              }}
              onReject={autoTags.remove}
            />
          </>
        )}
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

/**
 * The draft the AI buttons send: only the fields this type uses (content
 * typed under another type before switching to Link, say, isn't sent), the
 * file name for file types, and the tags the item already has.
 */
function toAiDraft(
  typeName: string,
  values: ItemFormValues,
  fields: EditableItemFields,
  fileName: string | null | undefined,
): AiItemDraft {
  return {
    typeName,
    title: values.title,
    description: values.description,
    content: fields.content ? values.content : "",
    url: fields.url ? values.url : "",
    language: fields.language ? values.language : "",
    fileName: fileName ?? "",
    tags: parseTagInput(values.tags),
  };
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
  /** Shown at the end of the label row, e.g. the Tags field's Suggest button. */
  labelAside?: React.ReactNode;
  error?: string;
  hint?: string;
  /** Renders the control, given the props that tie it to the label, hint and error. */
  children: (control: FieldControlProps) => React.ReactNode;
}

/** A labelled control with its hint and validation message wired up for screen readers. */
function Field({ id, label, labelAside, error, hint, children }: FieldProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ");

  return (
    <div className="grid gap-2">
      {labelAside ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <Label htmlFor={id}>{label}</Label>
          {labelAside}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
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
