"use client";

import { Copy } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copyToClipboard } from "@/lib/clipboard";
import { getLanguageLabel } from "@/lib/code-editor";
import { cn } from "@/lib/utils";

// Monaco needs the browser and is a large bundle, so it loads on first use and
// never on the server.
const MonacoEditor = dynamic(
  () => import("@/components/items/MonacoEditor").then((mod) => mod.MonacoEditor),
  { ssr: false, loading: () => <Skeleton className="m-3 h-14" /> },
);

/** In edit mode the editor keeps the old textarea's height while short or empty. */
const EDIT_MIN_HEIGHT = 160;

interface CodeEditorProps {
  value: string;
  /** The item's language, as typed. Shown in the header and used for highlighting. */
  language?: string | null;
  /** Display only. Omit `onChange` as well. */
  readOnly?: boolean;
  onChange?: (value: string) => void;
  /** The editor's accessible name, e.g. its field label. */
  ariaLabel: string;
  invalid?: boolean;
  /** Shown after the traffic lights, e.g. view tabs. */
  headerStart?: React.ReactNode;
  /** Shown before the copy button, e.g. an action. */
  headerEnd?: React.ReactNode;
  /** Wraps the editor, e.g. to put it in a tab panel beside other views. */
  renderBody?: (editor: React.ReactNode) => React.ReactNode;
}

/**
 * A code box styled as a macOS window: traffic-light dots, the language and a
 * copy button above a Monaco editor that grows with its content up to 400px,
 * then scrolls. Read-only for display, editable in forms.
 */
export function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  ariaLabel,
  invalid = false,
  headerStart,
  headerEnd,
  renderBody = (editor) => editor,
}: CodeEditorProps) {
  const editor = (
    <div className={cn(!readOnly && "min-h-40")}>
      <MonacoEditor
        value={value}
        language={language}
        readOnly={readOnly}
        onChange={onChange}
        ariaLabel={ariaLabel}
        minHeight={readOnly ? 0 : EDIT_MIN_HEIGHT}
      />
    </div>
  );

  return (
    <div
      className={cn(
        // overflow-hidden clips an opaque editor theme to the rounded corners.
        "overflow-hidden rounded-lg border transition-colors",
        // Monaco's scrollbar sliders, rounded to match the app.
        "[&_.monaco-scrollable-element>.scrollbar>.slider]:rounded-full",
        readOnly
          ? "border-border bg-muted/30"
          : "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
      )}
    >
      <CodeEditorHeader value={value} language={language} start={headerStart} end={headerEnd} />
      {renderBody(editor)}
    </div>
  );
}

interface CodeEditorHeaderProps {
  value: string;
  language?: string | null;
  start?: React.ReactNode;
  end?: React.ReactNode;
}

function CodeEditorHeader({ value, language, start, end }: Readonly<CodeEditorHeaderProps>) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-1.5 pr-1.5 pl-3">
      <div aria-hidden className="flex shrink-0 gap-1.5">
        <span className="size-3 rounded-full bg-red-500" />
        <span className="size-3 rounded-full bg-yellow-500" />
        <span className="size-3 rounded-full bg-green-500" />
      </div>

      {start}

      <span
        className={cn(
          "ml-auto truncate font-mono text-xs text-muted-foreground",
          // Beside tabs a phone has no room for it; the drawer's header shows the language too.
          start && "max-sm:hidden",
        )}
      >
        {getLanguageLabel(language)}
      </span>

      <div className={cn("flex items-center gap-1", start && "max-sm:ml-auto")}>
        {end}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Copy code"
          disabled={!value}
          onClick={() => void copyToClipboard(value)}
        >
          <Copy aria-hidden />
        </Button>
      </div>
    </div>
  );
}
