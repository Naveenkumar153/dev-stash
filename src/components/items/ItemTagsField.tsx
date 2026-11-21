"use client";

import { toast } from "sonner";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { Field } from "@/components/forms/Field";
import { SuggestTagsButton, TagSuggestionList } from "@/components/items/TagSuggestions";
import { Input } from "@/components/ui/input";
import { useAutoTags } from "@/hooks/use-auto-tags";
import { hasAiInput, type AiItemDraft } from "@/lib/ai-item";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { acceptSuggestedTag } from "@/lib/tags";

interface ItemTagsFieldProps {
  id: string;
  error?: string;
  /** The comma-separated tags as typed. */
  value: string;
  onChange: (value: string) => void;
  /** What the Suggest Tags button sends. */
  aiDraft: AiItemDraft;
}

/**
 * The comma-separated Tags field, with the Pro-only Suggest Tags button and
 * the suggestions to accept or dismiss. Accepting adds the tag to the input;
 * nothing is saved until the form is.
 */
export function ItemTagsField({ id, error, value, onChange, aiDraft }: Readonly<ItemTagsFieldProps>) {
  const hasProAccess = useProAccess();
  const autoTags = useAutoTags();

  function accept(tag: string) {
    const result = acceptSuggestedTag(value, tag, ITEM_LIMITS.tagCount);
    if (result.status === "full") {
      toast.error(`Add up to ${ITEM_LIMITS.tagCount} tags`);
      return;
    }
    onChange(result.tags);
    autoTags.remove(tag);
  }

  return (
    <Field
      id={id}
      error={error}
      label="Tags"
      hint="Separate tags with commas"
      labelAside={
        hasProAccess && (
          <SuggestTagsButton
            pending={autoTags.pending}
            canSuggest={hasAiInput(aiDraft)}
            onClick={() => autoTags.suggest(aiDraft)}
          />
        )
      }
    >
      {(control) => (
        <>
          <Input
            {...control}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="react, hooks"
          />
          <TagSuggestionList
            suggestions={autoTags.suggestions}
            onAccept={accept}
            onReject={autoTags.remove}
          />
        </>
      )}
    </Field>
  );
}
