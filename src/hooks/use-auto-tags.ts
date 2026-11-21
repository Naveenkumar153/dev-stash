"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { generateAutoTags } from "@/actions/ai";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { callAction } from "@/lib/action-call";
import { AI_TAGS_FAILED } from "@/lib/action-result";
import type { AiDraftInput } from "@/lib/ai-schemas";

export interface AutoTagsState {
  /** Suggestions the user hasn't accepted or rejected yet. */
  suggestions: string[];
  pending: boolean;
  /** Asks the model for tags for `draft`, replacing any earlier suggestions. */
  suggest: (draft: AiDraftInput) => void;
  /** Drops one suggestion, after it's been accepted or rejected. */
  remove: (tag: string) => void;
}

/**
 * The form's AI tag suggestions. They're form state only: discarded with the
 * form, and nothing is saved until Create or Save. Failures toast, with an
 * Upgrade action when the account needs Pro.
 */
export function useAutoTags(): AutoTagsState {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const showError = useUpgradeErrorToast();

  function suggest(draft: AiDraftInput) {
    startTransition(async () => {
      const result = await callAction(() => generateAutoTags(draft));
      if (!result) {
        return;
      }
      if (!result.success || !result.data) {
        showError(result.error, AI_TAGS_FAILED);
        return;
      }
      if (result.data.tags.length === 0) {
        toast.info("No new tags to suggest.");
      }
      setSuggestions(result.data.tags);
    });
  }

  function remove(tag: string) {
    setSuggestions((current) => current.filter((suggestion) => suggestion !== tag));
  }

  return { suggestions, pending, suggest, remove };
}
