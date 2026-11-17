import { Sparkles } from "lucide-react";

import {
  AI_CODE_SAMPLE,
  AI_GENERATED_TAGS,
  type CodeToken,
  type CodeTokenKind,
} from "@/lib/homepage";
import { cn } from "@/lib/utils";

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  keyword: "text-purple-400",
  function: "text-blue-400",
  type: "text-amber-400",
};

/** The tags "generate" one after another once the editor is revealed. */
const TAG_DELAYS = ["delay-600", "delay-850", "delay-1100", "delay-1350", "delay-1600"];

function CodeLine({ tokens, number }: Readonly<{ tokens: readonly CodeToken[]; number: number }>) {
  return (
    <li className="min-h-[1.7em] whitespace-pre">
      <span className="inline-block w-[3.2em] pr-[1.2em] text-right text-muted-foreground/50 select-none">
        {number}
      </span>
      {tokens.map((token, i) =>
        typeof token === "string" ? (
          token
        ) : (
          <span key={i} className={TOKEN_CLASSES[token.kind]}>
            {token.text}
          </span>
        ),
      )}
    </li>
  );
}

/** The AI section's editor: a `useDebounce` snippet and its AI-generated tags. */
export function CodeEditorMockup() {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-[0_30px_80px_-40px_rgb(99_102_241/0.45)]">
      <div className="flex h-10 items-center gap-3 border-b bg-card px-3.5 font-mono text-xs">
        <span aria-hidden className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-[#ff5f57]" />
          <i className="size-2.5 rounded-full bg-[#febc2e]" />
          <i className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="text-muted-foreground">useDebounce.ts</span>
        <span className="ml-auto text-muted-foreground">typescript</span>
      </div>

      <ol
        aria-label="useDebounce.ts"
        className="overflow-x-auto py-4 pr-4 font-mono text-xs leading-[1.7] text-foreground/85 sm:text-[13px]"
      >
        {AI_CODE_SAMPLE.map((tokens, i) => (
          <CodeLine key={i} tokens={tokens} number={i + 1} />
        ))}
      </ol>

      <figcaption className="border-t bg-type-prompt/5 px-4 pt-3.5 pb-4">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-type-prompt uppercase">
          <Sparkles aria-hidden className="size-3.5" />
          AI Generated Tags
        </span>
        <span className="mt-2.5 flex flex-wrap gap-2">
          {AI_GENERATED_TAGS.map((tag, i) => (
            <span
              key={tag}
              className={cn(
                "rounded-md border bg-muted px-2.5 py-0.75 font-mono text-xs text-muted-foreground transition-[opacity,translate,scale] duration-350 in-reveal-pending:translate-y-1.5 in-reveal-pending:scale-92 in-reveal-pending:opacity-0",
                TAG_DELAYS[i],
              )}
            >
              {tag}
            </span>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
