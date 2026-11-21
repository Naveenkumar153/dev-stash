"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { AI_PRO_REQUIRED } from "@/lib/action-result";

/** The locked button's tooltip, from the spec. */
export const EXPLAIN_PRO_TOOLTIP = "AI features require Pro subscription";

interface ExplainCodeButtonProps {
  hasProAccess: boolean;
  pending: boolean;
  onClick: () => void;
}

/**
 * The code box's "Explain" button. With Pro it asks for an explanation and
 * reads "Explaining..." while it works. Without Pro it shows a crown and a
 * tooltip, and a click offers the upgrade instead of calling the server.
 */
export function ExplainCodeButton({ hasProAccess, pending, onClick }: ExplainCodeButtonProps) {
  const showError = useUpgradeErrorToast();

  if (!hasProAccess) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              aria-label={`Explain: ${EXPLAIN_PRO_TOOLTIP}`}
              onClick={() => showError(AI_PRO_REQUIRED, AI_PRO_REQUIRED)}
            />
          }
        >
          <Crown aria-hidden className="text-amber-400" />
          Explain
        </TooltipTrigger>
        <TooltipContent>{EXPLAIN_PRO_TOOLTIP}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      title="Explain this code with AI"
      onClick={onClick}
      disabled={pending}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
      {pending ? "Explaining..." : "Explain"}
    </Button>
  );
}
