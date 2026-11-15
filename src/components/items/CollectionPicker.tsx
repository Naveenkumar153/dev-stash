"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import type { CollectionOptionsState } from "@/hooks/use-collection-options";
import type { CollectionOption } from "@/types/collections";

interface CollectionPickerProps {
  /** The text input's id, so the field's label focuses it. */
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  /** The user's collections, or why they aren't listed yet. */
  options: CollectionOptionsState;
  value: CollectionOption[];
  onChange: (value: CollectionOption[]) => void;
}

const NO_OPTIONS: CollectionOption[] = [];

/**
 * Picks any number of the user's collections, shown as removable chips with
 * type-to-filter. Selections are matched by id, so the chips an item already
 * has (from its detail) count as selected once the options load. Disabled
 * until they do.
 */
export function CollectionPicker({
  id,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  options,
  value,
  onChange,
}: CollectionPickerProps) {
  const anchor = useComboboxAnchor();
  const collections = options.status === "ready" ? options.collections : NO_OPTIONS;

  return (
    <Combobox
      multiple
      autoHighlight
      items={collections}
      value={value}
      onValueChange={(next, details) => {
        // Base UI clears the whole selection when Escape is pressed with the
        // list closed, and keeps the key from the dialog. Someone pressing
        // Escape to close the form would silently lose their collections, so
        // the clear is ignored and Escape goes on to close the dialog as usual.
        if (details.reason === "escape-key") {
          details.allowPropagation();
          return;
        }
        onChange(next);
      }}
      itemToStringLabel={(collection: CollectionOption) => collection.name}
      itemToStringValue={(collection: CollectionOption) => collection.id}
      isItemEqualToValue={(a: CollectionOption, b: CollectionOption) => a.id === b.id}
      disabled={options.status !== "ready"}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(selected: CollectionOption[]) => (
            <>
              {selected.map((collection) => (
                <ComboboxChip
                  key={collection.id}
                  className="max-w-full"
                  removeLabel={`Remove ${collection.name}`}
                >
                  <span className="truncate">{collection.name}</span>
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                placeholder={selected.length === 0 ? "Add to collections..." : undefined}
                className="h-6 bg-transparent"
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>
          {collections.length === 0 ? "No collections yet" : "No matching collections"}
        </ComboboxEmpty>
        {/*
          The full available height: shadcn's default keeps 36px back for a
          search input inside the popup, which the chips layout doesn't have,
          so near the bottom of the screen the list shrank to a sliver.
        */}
        <ComboboxList className="max-h-[min(--spacing(72),var(--available-height))]">
          {(collection: CollectionOption) => (
            <ComboboxItem key={collection.id} value={collection}>
              <span className="truncate">{collection.name}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
