"use client";

import { useState, useTransition } from "react";

import { explainCode } from "@/actions/ai";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { callAction } from "@/lib/action-call";
import { AI_EXPLAIN_FAILED } from "@/lib/action-result";

export type CodeView = "code" | "explain";

export interface ExplainCodeState {
  /** The last explanation, as Markdown; null until one arrives. */
  explanation: string | null;
  view: CodeView;
  setView: (view: CodeView) => void;
  pending: boolean;
  /** Asks for a new explanation of the saved item and shows it. */
  explain: () => void;
}

/**
 * A drawer code box's Explain state. Nothing is saved: the explanation lives
 * here until the drawer moves to another item. Failures toast, with an
 * Upgrade action when the account needs Pro.
 */
export function useExplainCode(itemId: string): ExplainCodeState {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [view, setView] = useState<CodeView>("code");
  const [pending, startTransition] = useTransition();
  const showError = useUpgradeErrorToast();

  function explain() {
    startTransition(async () => {
      const result = await callAction(() => explainCode(itemId));
      if (!result) {
        return;
      }
      if (!result.success || !result.data) {
        showError(result.error, AI_EXPLAIN_FAILED);
        return;
      }

      setExplanation(result.data.explanation);
      setView("explain");
    });
  }

  return { explanation, view, setView, pending, explain };
}
