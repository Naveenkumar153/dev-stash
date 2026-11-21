"use client";

import { Copy } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

// The markdown parser only matters once something is previewed, so it stays
// out of the shell bundle that every page with the New Item button loads.
const MarkdownPreview = dynamic(
  () => import("@/components/items/MarkdownPreview").then((mod) => mod.MarkdownPreview),
  { loading: () => <Skeleton className="h-14" /> },
);

type MarkdownTab = "write" | "preview";

/** One read-only version of the text, shown as its own tab (e.g. Original / Optimized). */
export interface MarkdownView {
  value: string;
  label: string;
  content: string;
}

interface MarkdownEditorProps {
  value: string;
  /** Display only: just the Preview tab. Omit `onChange` as well. */
  readOnly?: boolean;
  onChange?: (value: string) => void;
  /** The editor's accessible name, e.g. its field label. */
  ariaLabel: string;
  /** The Write textarea's id, so a `<label htmlFor>` focuses it. */
  id?: string;
  /** Ids of the field's hint and error, read out with the textarea. */
  describedBy?: string;
  invalid?: boolean;
  /**
   * Read-only only: several versions to switch between, each its own tab, in
   * place of the single Preview of `value`. Copy copies the one on show.
   */
  views?: MarkdownView[];
  /** The view on show, when the parent controls it. */
  view?: string;
  onViewChange?: (view: string) => void;
  /** Shown before the copy button, e.g. an action. */
  headerEnd?: React.ReactNode;
}

/**
 * A markdown box matching the code editor: a header with Write / Preview tabs
 * and a copy button above a textarea or the rendered preview, either growing
 * with its content up to 400px, then scrolling. Read-only shows only Preview;
 * editable opens on Write.
 */
export function MarkdownEditor({
  value,
  readOnly = false,
  onChange,
  ariaLabel,
  id,
  describedBy,
  invalid = false,
  views,
  view,
  onViewChange,
  headerEnd,
}: MarkdownEditorProps) {
  const previews: MarkdownView[] =
    readOnly && views ? views : [{ value: "preview" satisfies MarkdownTab, label: "Preview", content: value }];
  const [ownTab, setOwnTab] = useState<string>(readOnly ? previews[0].value : "write");
  // Views can come and go (an optimized prompt dismissed), so a tab that no
  // longer exists falls back to the first.
  const tab =
    view ?? (readOnly && !previews.some((preview) => preview.value === ownTab) ? previews[0].value : ownTab);
  const copyText = previews.find((preview) => preview.value === tab)?.content ?? value;

  function changeTab(next: string) {
    setOwnTab(next);
    onViewChange?.(next);
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => changeTab(String(next))}
      className={cn(
        // min-w-0: inside a grid field, wide tables and code blocks scroll instead of widening the form.
        "min-w-0 gap-0 rounded-lg border transition-colors",
        readOnly
          ? "border-border bg-muted/30"
          : "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
      )}
    >
      <div className="flex items-center gap-3 border-b border-border py-1.5 pr-1.5 pl-1.5">
        <TabsList aria-label={ariaLabel} className="group-data-horizontal/tabs:h-7">
          {!readOnly && <MarkdownTabTrigger value="write">Write</MarkdownTabTrigger>}
          {previews.map((preview) => (
            <MarkdownTabTrigger key={preview.value} value={preview.value}>
              {preview.label}
            </MarkdownTabTrigger>
          ))}
        </TabsList>

        <div className="ml-auto flex items-center gap-1">
          {headerEnd}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Copy content"
            disabled={!copyText}
            onClick={() => void copyToClipboard(copyText)}
          >
            <Copy aria-hidden />
          </Button>
        </div>
      </div>

      {!readOnly && (
        <TabsContent value="write">
          <Textarea
            id={id}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            aria-label={id ? undefined : ariaLabel}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            spellCheck={false}
            className={cn(
              "max-h-100 min-h-40 overflow-y-auto rounded-none rounded-b-lg border-0 bg-transparent px-3 py-2.5",
              "font-mono text-[13px] leading-relaxed md:text-[13px]",
              "focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent",
            )}
          />
        </TabsContent>
      )}

      {previews.map((preview) => (
        <TabsContent
          key={preview.value}
          value={preview.value}
          className={cn(
            "max-h-100 overflow-y-auto rounded-b-lg px-4 py-3",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
            !readOnly && "min-h-40",
          )}
        >
          {preview.content.trim() ? (
            <div className="markdown-preview">
              <MarkdownPreview value={preview.content} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview</p>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function MarkdownTabTrigger({
  value,
  children,
}: Readonly<{ value: string; children: React.ReactNode }>) {
  return (
    <TabsTrigger value={value} className="px-2.5 text-xs">
      {children}
    </TabsTrigger>
  );
}
