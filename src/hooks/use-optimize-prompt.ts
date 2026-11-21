"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { optimizePrompt } from "@/actions/ai";
import { setItemContent } from "@/actions/items";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { callAction } from "@/lib/action-call";
import { AI_OPTIMIZE_FAILED, CONTENT_SAVE_FAILED } from "@/lib/action-result";
import { PROMPT_ALREADY_GOOD } from "@/lib/ai-optimize";
import type { ItemDetail } from "@/types/items";

export type PromptView = "original" | "optimized";

/** What the drawer merges into the item it shows once new content is saved. */
export type ContentSaved = (id: string, changes: Pick<ItemDetail, "content" | "updatedAt">) => void;

export interface PromptSuggestion {
  optimizedPrompt: string;
  changes: string[];
}

export interface OptimizePromptState {
  /** The refined prompt waiting on the user's answer; null when there's none. */
  suggestion: PromptSuggestion | null;
  view: PromptView;
  setView: (view: PromptView) => void;
  /** Asking the model. */
  pending: boolean;
  /** Saving the refined prompt. */
  saving: boolean;
  optimize: () => void;
  /** Saves the refined prompt as the item's content, with Undo in the toast. */
  acceptSuggestion: () => void;
  /** Dismisses the refined prompt and keeps the saved one. */
  keepOriginal: () => void;
}

/** Saves `content` and reports it, toasting on failure. Used by Use and by Undo. */
async function saveContent(
  itemId: string,
  content: string,
  onSaved: ContentSaved,
): Promise<boolean> {
  const result = await callAction(() => setItemContent(itemId, content));
  if (!result) {
    return false;
  }
  if (!result.success || !result.data) {
    toast.error(result.error ?? CONTENT_SAVE_FAILED);
    return false;
  }
  onSaved(result.data.id, { content: result.data.content, updatedAt: result.data.updatedAt });
  return true;
}

/**
 * A drawer prompt box's Optimize state. The model reviews the saved prompt
 * and refines it only if needed; a refinement waits here until the user
 * chooses to use it or keep the original, and is lost if the drawer moves on.
 * `original` is the saved prompt, which Undo writes back.
 */
export function useOptimizePrompt(
  itemId: string,
  original: string,
  onSaved: ContentSaved,
): OptimizePromptState {
  const [suggestion, setSuggestion] = useState<PromptSuggestion | null>(null);
  const [view, setView] = useState<PromptView>("original");
  const [pending, startOptimizing] = useTransition();
  const [saving, startSaving] = useTransition();
  const showError = useUpgradeErrorToast();

  function optimize() {
    startOptimizing(async () => {
      const result = await callAction(() => optimizePrompt(itemId));
      if (!result) {
        return;
      }
      if (!result.success || !result.data) {
        showError(result.error, AI_OPTIMIZE_FAILED);
        return;
      }
      if (!result.data.changed) {
        setSuggestion(null);
        setView("original");
        toast.success(PROMPT_ALREADY_GOOD);
        return;
      }

      setSuggestion({ optimizedPrompt: result.data.optimizedPrompt, changes: result.data.changes });
      setView("optimized");
    });
  }

  function acceptSuggestion() {
    if (!suggestion) {
      return;
    }
    startSaving(async () => {
      // A successful save changes the item's `updatedAt`, which remounts this
      // box without the suggestion, so there's no state to clear here.
      if (await saveContent(itemId, suggestion.optimizedPrompt, onSaved)) {
        toast.success("Prompt updated", {
          action: {
            label: "Undo",
            onClick: () => {
              void saveContent(itemId, original, onSaved).then(
                (restored) => restored && toast.success("Original prompt restored"),
              );
            },
          },
        });
      }
    });
  }

  function keepOriginal() {
    setSuggestion(null);
    setView("original");
  }

  return { suggestion, view, setView, pending, saving, optimize, acceptSuggestion, keepOriginal };
}
