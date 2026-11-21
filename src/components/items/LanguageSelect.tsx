"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import {
  getLanguageOptions,
  PLAIN_TEXT_LABEL,
  PLAIN_TEXT_LANGUAGE,
  toLanguageSelectValue,
  type CodeLanguage,
} from "@/lib/code-editor";
import { cn } from "@/lib/utils";

interface LanguageSelectProps {
  /** The trigger's id, so the field's label names and focuses it. */
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  /** The item's language as stored or picked; blank for plain text. */
  value: string;
  onChange: (value: string) => void;
}

const PLAIN_TEXT_OPTION: CodeLanguage = { value: PLAIN_TEXT_LANGUAGE, label: PLAIN_TEXT_LABEL };

/**
 * The Language picker for code items: a select-style button that opens a
 * searchable list of Plain text, the listed languages, and the item's own
 * value when it isn't one of them. Plain text is sent as a blank, which saves
 * no language.
 */
export function LanguageSelect({
  id,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  value,
  onChange,
}: LanguageSelectProps) {
  const options = [PLAIN_TEXT_OPTION, ...getLanguageOptions(value)];
  const selectedValue = toLanguageSelectValue(value);
  const selected = options.find((option) => option.value === selectedValue) ?? PLAIN_TEXT_OPTION;

  return (
    <Combobox
      autoHighlight
      items={options}
      value={selected}
      onValueChange={(next, details) => {
        // A language is always selected, so a cleared value is ignored. Escape
        // still goes on to close the dialog or drawer, as in CollectionPicker.
        if (!next) {
          if (details.reason === "escape-key") {
            details.allowPropagation();
          }
          return;
        }
        onChange(next.value === PLAIN_TEXT_LANGUAGE ? "" : next.value);
      }}
      itemToStringLabel={(option: CodeLanguage) => option.label}
      itemToStringValue={(option: CodeLanguage) => option.value}
      isItemEqualToValue={(a: CodeLanguage, b: CodeLanguage) => a.value === b.value}
    >
      <ComboboxTrigger
        id={id}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-left text-sm whitespace-nowrap transition-colors outline-none select-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        )}
      >
        <span className="truncate">
          <ComboboxValue />
        </span>
      </ComboboxTrigger>
      <ComboboxContent>
        <ComboboxInput
          showTrigger={false}
          placeholder="Search languages..."
          aria-label="Search languages"
          spellCheck={false}
        />
        <ComboboxEmpty>No languages found.</ComboboxEmpty>
        <ComboboxList>
          {(option: CodeLanguage) => (
            <ComboboxItem key={option.value} value={option}>
              <span className="truncate">{option.label}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
