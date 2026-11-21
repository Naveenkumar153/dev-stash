import { useId } from "react";

import { Field } from "@/components/forms/Field";
import { ItemCollectionsField } from "@/components/items/ItemCollectionsField";
import { ItemContentField } from "@/components/items/ItemContentField";
import { ItemDescriptionField } from "@/components/items/ItemDescriptionField";
import { ItemTagsField } from "@/components/items/ItemTagsField";
import { LanguageSelect } from "@/components/items/LanguageSelect";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/lib/action-result";
import type { AiItemDraft } from "@/lib/ai-item";
import { ITEM_LIMITS } from "@/lib/item-limits";
import type { UpdateItemInput } from "@/lib/item-schemas";
import type { ContentEditorKind, EditableItemFields } from "@/lib/item-types";
import { parseTagInput } from "@/lib/tags";
import type { CollectionOption } from "@/types/collections";

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
 * fields. Each field that needs its own state (an AI button, the collection
 * options) owns it, so a tag suggestion re-renders only the Tags field.
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
  const aiDraft = toAiDraft(typeName, values, fields, fileName);
  const field = (name: keyof ItemFormValues) => ({ id: `${id}-${name}`, error: errors[name] });

  return (
    <div className="flex flex-col gap-5">
      <Field {...field("title")} label="Title">
        {(control) => (
          <Input
            {...control}
            value={values.title}
            onChange={(event) => onChange("title", event.target.value)}
            required
            autoFocus
            maxLength={ITEM_LIMITS.title}
          />
        )}
      </Field>

      <ItemDescriptionField
        {...field("description")}
        value={values.description}
        onChange={(value) => onChange("description", value)}
        aiDraft={aiDraft}
      />

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
        <ItemContentField
          {...field("content")}
          value={values.content}
          onChange={(value) => onChange("content", value)}
          editor={contentEditor}
          language={values.language}
        />
      )}

      {fields.url && (
        <Field {...field("url")} label="URL">
          {(control) => (
            <Input
              {...control}
              value={values.url}
              onChange={(event) => onChange("url", event.target.value)}
              type="url"
              placeholder="https://"
              spellCheck={false}
              maxLength={ITEM_LIMITS.url}
            />
          )}
        </Field>
      )}

      <ItemTagsField
        {...field("tags")}
        value={values.tags}
        onChange={(value) => onChange("tags", value)}
        aiDraft={aiDraft}
      />

      <ItemCollectionsField
        id={`${id}-collections`}
        error={errors.collectionIds}
        value={values.collections}
        onChange={(value) => onChange("collections", value)}
      />
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
