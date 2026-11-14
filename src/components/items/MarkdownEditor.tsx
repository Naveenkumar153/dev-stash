"use client";

import { Copy } from "lucide-react";
import dynamic from "next/dynamic";

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
}: MarkdownEditorProps) {
  return (
    <Tabs
      defaultValue={(readOnly ? "preview" : "write") satisfies MarkdownTab}
      className={cn(
        // min-w-0: inside a grid field, wide tables and code blocks scroll instead of widening the form.
        "min-w-0 gap-0 rounded-lg border transition-colors",
        readOnly
          ? "border-border bg-muted/30"
          : "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
      )}
    >
      <div className="flex items-center gap-3 border-b border-border py-1.5 pr-1.5 pl-1.5">
        <TabsList aria-label={ariaLabel} className="group-data-horizontal/tabs:h-7">
          {!readOnly && <MarkdownTabTrigger value="write">Write</MarkdownTabTrigger>}
          <MarkdownTabTrigger value="preview">Preview</MarkdownTabTrigger>
        </TabsList>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Copy content"
          disabled={!value}
          onClick={() => void copyToClipboard(value)}
          className="ml-auto"
        >
          <Copy aria-hidden />
        </Button>
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

      <TabsContent
        value="preview"
        aria-label={`${ariaLabel} preview`}
        className={cn(
          "max-h-100 overflow-y-auto rounded-b-lg px-4 py-3",
          "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
          !readOnly && "min-h-40",
        )}
      >
        {value.trim() ? (
          <div className="markdown-preview">
            <MarkdownPreview value={value} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing to preview</p>
        )}
      </TabsContent>
    </Tabs>
  );
}

function MarkdownTabTrigger({
  value,
  children,
}: Readonly<{ value: MarkdownTab; children: React.ReactNode }>) {
  return (
    <TabsTrigger value={value} className="px-2.5 text-xs">
      {children}
    </TabsTrigger>
  );
}
