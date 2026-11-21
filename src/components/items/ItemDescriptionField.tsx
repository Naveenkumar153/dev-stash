"use client";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { Field } from "@/components/forms/Field";
import { GenerateDescriptionButton } from "@/components/items/GenerateDescriptionButton";
import { Textarea } from "@/components/ui/textarea";
import { useAiDescription } from "@/hooks/use-ai-description";
import { hasAiInput, type AiItemDraft } from "@/lib/ai-item";
import { ITEM_LIMITS } from "@/lib/item-limits";

interface ItemDescriptionFieldProps {
  id: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** What the Describe button sends. */
  aiDraft: AiItemDraft;
}

/** The Description field, with the Pro-only Describe button that writes it with AI. */
export function ItemDescriptionField({
  id,
  error,
  value,
  onChange,
  aiDraft,
}: Readonly<ItemDescriptionFieldProps>) {
  const hasProAccess = useProAccess();
  const aiDescription = useAiDescription(onChange);

  return (
    <Field
      id={id}
      error={error}
      label="Description"
      labelAside={
        hasProAccess && (
          <GenerateDescriptionButton
            pending={aiDescription.pending}
            canGenerate={hasAiInput(aiDraft)}
            onClick={() => aiDescription.generate(aiDraft)}
          />
        )
      }
    >
      {(control) => (
        <Textarea
          {...control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={ITEM_LIMITS.description}
          className="min-h-20"
        />
      )}
    </Field>
  );
}
