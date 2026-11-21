"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AI_NEEDS_INPUT } from "@/lib/ai-item";

interface GenerateDescriptionButtonProps {
  pending: boolean;
  /** False while there's nothing for the model to read. */
  canGenerate: boolean;
  onClick: () => void;
}

/**
 * The Description field's "Describe" button, which writes a description with
 * AI; it reads "Describing..." while it works. Only rendered for users with Pro
 * access. The tooltip says what it does, or why it's disabled.
 */
export function GenerateDescriptionButton({
  pending,
  canGenerate,
  onClick,
}: GenerateDescriptionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      title={canGenerate ? "Write a description with AI" : AI_NEEDS_INPUT}
      onClick={onClick}
      disabled={pending || !canGenerate}
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
      {pending ? "Describing..." : "Describe"}
    </Button>
  );
}
