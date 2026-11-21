"use client";

import { Crown, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpgradeErrorToast } from "@/hooks/use-upgrade-error-toast";
import { AI_PRO_REQUIRED } from "@/lib/action-result";

/** The locked button's tooltip. */
export const AI_PRO_TOOLTIP = "AI features require Pro subscription";

interface AiHeaderButtonProps {
  hasProAccess: boolean;
  pending: boolean;
  onClick: () => void;
  /** e.g. "Explain". */
  label: string;
  /** e.g. "Explaining...". */
  pendingLabel: string;
  /** What the button does, as its tooltip. */
  title: string;
  /** Disabled for another reason than its own request, e.g. a save in progress. */
  disabled?: boolean;
}

/**
 * An AI action in a content box's header, such as Explain or Optimize. With
 * Pro it runs the action and reads `pendingLabel` while it works. Without Pro
 * it shows a crown and a tooltip, and a click offers the upgrade instead of
 * calling the server.
 */
export function AiHeaderButton({
  hasProAccess,
  pending,
  onClick,
  label,
  pendingLabel,
  title,
  disabled = false,
}: AiHeaderButtonProps) {
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
              aria-label={`${label}: ${AI_PRO_TOOLTIP}`}
              onClick={() => showError(AI_PRO_REQUIRED, AI_PRO_REQUIRED)}
            />
          }
        >
          <Crown aria-hidden className="text-amber-400" />
          {label}
        </TooltipTrigger>
        <TooltipContent>{AI_PRO_TOOLTIP}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="ghost" size="xs" title={title} onClick={onClick} disabled={pending || disabled}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
      {pending ? pendingLabel : label}
    </Button>
  );
}
