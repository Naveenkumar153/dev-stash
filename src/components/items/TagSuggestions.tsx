"use client";

import { Check, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AI_NEEDS_INPUT } from "@/lib/ai-item";

interface SuggestTagsButtonProps {
  pending: boolean;
  /** False while there's no title or content for the model to read. */
  canSuggest: boolean;
  onClick: () => void;
}

/** The Tags field's "Suggest Tags" button. Only rendered for users with Pro access. */
export function SuggestTagsButton({ pending, canSuggest, onClick }: SuggestTagsButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      onClick={onClick}
      disabled={pending || !canSuggest}
      title={canSuggest ? undefined : AI_NEEDS_INPUT}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
      {pending ? "Suggesting..." : "Suggest Tags"}
    </Button>
  );
}

interface TagSuggestionListProps {
  suggestions: string[];
  onAccept: (tag: string) => void;
  onReject: (tag: string) => void;
}

/**
 * The model's suggested tags as dashed badges, each with accept (check) and
 * reject (X). A polite live region announces how many arrived.
 */
export function TagSuggestionList({ suggestions, onAccept, onReject }: TagSuggestionListProps) {
  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {suggestions.length > 0
          ? `${suggestions.length} tag suggestion${suggestions.length === 1 ? "" : "s"}`
          : ""}
      </p>
      {suggestions.length > 0 && (
        <ul aria-label="Suggested tags" className="flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <li
              key={tag}
              className="flex h-6 items-center gap-0.5 rounded-md border border-dashed border-border pl-2 text-xs"
            >
              <span>{tag}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Add tag ${tag}`}
                className="text-emerald-400 hover:text-emerald-300"
                onClick={() => onAccept(tag)}
              >
                <Check aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Dismiss tag ${tag}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onReject(tag)}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
