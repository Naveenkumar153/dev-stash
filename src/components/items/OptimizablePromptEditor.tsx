"use client";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { AiHeaderButton } from "@/components/items/AiHeaderButton";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Button } from "@/components/ui/button";
import {
  useOptimizePrompt,
  type ContentSaved,
  type PromptSuggestion,
  type PromptView,
} from "@/hooks/use-optimize-prompt";

interface OptimizablePromptEditorProps {
  itemId: string;
  content: string;
  onContentSaved: ContentSaved;
}

/**
 * The drawer's read-only prompt box with AI Optimize: an "Optimize" button
 * beside Copy, and once the model refines the prompt, Original / Optimized
 * tabs in the header and a bar under the box asking whether to use it.
 */
export function OptimizablePromptEditor({
  itemId,
  content,
  onContentSaved,
}: OptimizablePromptEditorProps) {
  const hasProAccess = useProAccess();
  const { suggestion, view, setView, pending, saving, optimize, acceptSuggestion, keepOriginal } =
    useOptimizePrompt(itemId, content, onContentSaved);

  return (
    <div className="flex flex-col gap-3">
      <MarkdownEditor
        value={content}
        readOnly
        ariaLabel="Content"
        views={
          suggestion
            ? [
                { value: "original" satisfies PromptView, label: "Original", content },
                {
                  value: "optimized" satisfies PromptView,
                  label: "Optimized",
                  content: suggestion.optimizedPrompt,
                },
              ]
            : undefined
        }
        view={suggestion ? view : undefined}
        onViewChange={(next) => setView(next as PromptView)}
        headerEnd={
          <AiHeaderButton
            hasProAccess={hasProAccess}
            pending={pending}
            disabled={saving}
            onClick={optimize}
            label="Optimize"
            pendingLabel="Optimizing..."
            title="Optimize this prompt with AI"
          />
        }
      />

      {suggestion && (
        <PromptSuggestionBar
          suggestion={suggestion}
          saving={saving}
          onUse={acceptSuggestion}
          onKeep={keepOriginal}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {pending ? "Optimizing the prompt..." : suggestion ? "Optimized prompt ready" : ""}
      </p>
    </div>
  );
}

interface PromptSuggestionBarProps {
  suggestion: PromptSuggestion;
  saving: boolean;
  onUse: () => void;
  onKeep: () => void;
}

/** What the model changed, and the question: use the updated prompt or keep the original. */
function PromptSuggestionBar({ suggestion, saving, onUse, onKeep }: PromptSuggestionBarProps) {
  return (
    <section
      aria-label="Optimized prompt"
      className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-3"
    >
      {suggestion.changes.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">What changed</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {suggestion.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Use this prompt?</p>
        {/* The two answers wrap as a pair, so a narrow drawer doesn't split them. */}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onKeep} disabled={saving}>
            Keep original
          </Button>
          <Button type="button" size="sm" onClick={onUse} disabled={saving}>
            {saving ? "Saving..." : "Use updated prompt"}
          </Button>
        </div>
      </div>
    </section>
  );
}
