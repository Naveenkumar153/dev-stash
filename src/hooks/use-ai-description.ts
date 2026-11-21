"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { generateDescription } from "@/actions/ai";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { callAction } from "@/lib/action-call";
import { AI_DESCRIPTION_FAILED } from "@/lib/action-result";
import type { AiDraftInput } from "@/lib/ai-schemas";

export interface AiDescriptionState {
  pending: boolean;
  /**
   * Asks the model for a description of `draft` and puts it in the field
   * through `apply`. `draft.description` is what the field held at the click,
   * which Undo restores when the new text replaced it.
   */
  generate: (draft: AiDraftInput) => void;
}

/**
 * The Description field's AI writer. It fills the field directly; nothing is
 * saved until Create or Save. Replacing text the user had offers Undo, and
 * failures toast, with an Upgrade action when the account needs Pro.
 */
export function useAiDescription(apply: (description: string) => void): AiDescriptionState {
  const [pending, startTransition] = useTransition();
  const showError = useUpgradeErrorToast();

  function generate(draft: AiDraftInput) {
    const previous = draft.description ?? "";

    startTransition(async () => {
      const result = await callAction(() => generateDescription(draft));
      if (!result) {
        return;
      }
      if (!result.success || !result.data) {
        showError(result.error, AI_DESCRIPTION_FAILED);
        return;
      }

      apply(result.data.description);
      if (previous.trim()) {
        toast.success("Description replaced", {
          action: { label: "Undo", onClick: () => apply(previous) },
        });
      } else {
        toast.success("Description generated");
      }
    });
  }

  return { pending, generate };
}
