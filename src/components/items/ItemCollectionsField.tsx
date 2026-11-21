"use client";

import { Field } from "@/components/forms/Field";
import { CollectionPicker } from "@/components/items/CollectionPicker";
import { useCollectionOptions, type CollectionOptionsState } from "@/hooks/use-collection-options";
import type { CollectionOption } from "@/types/collections";

interface ItemCollectionsFieldProps {
  id: string;
  error?: string;
  value: CollectionOption[];
  onChange: (value: CollectionOption[]) => void;
}

/** The Collections picker. The user's collections are loaded when the field mounts. */
export function ItemCollectionsField({
  id,
  error,
  value,
  onChange,
}: Readonly<ItemCollectionsFieldProps>) {
  const options = useCollectionOptions();

  return (
    <Field id={id} error={error} label="Collections" hint={getCollectionsHint(options)}>
      {(control) => (
        <CollectionPicker {...control} options={options} value={value} onChange={onChange} />
      )}
    </Field>
  );
}

/** What the field says under the picker while it loads, fails or has nothing to list. */
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
