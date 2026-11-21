"use client";

import dynamic from "next/dynamic";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { CodeEditor } from "@/components/items/CodeEditor";
import { ExplainCodeButton } from "@/components/items/ExplainCodeButton";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExplainCode, type CodeView } from "@/hooks/use-explain-code";
import { cn } from "@/lib/utils";

// The markdown parser loads only once an explanation is shown.
const MarkdownPreview = dynamic(
  () => import("@/components/items/MarkdownPreview").then((mod) => mod.MarkdownPreview),
  { loading: () => <Skeleton className="h-14" /> },
);

interface ExplainableCodeEditorProps {
  itemId: string;
  content: string;
  language: string | null;
}

/**
 * The drawer's read-only code box with AI Explain: an "Explain" button beside
 * Copy, and once an explanation arrives, Code / Explain tabs in the header
 * that switch the box between the code and the rendered explanation.
 */
export function ExplainableCodeEditor({ itemId, content, language }: ExplainableCodeEditorProps) {
  const hasProAccess = useProAccess();
  const { explanation, view, setView, pending, explain } = useExplainCode(itemId);

  return (
    <Tabs
      value={explanation ? view : "code"}
      onValueChange={(value) => setView(value as CodeView)}
      className="gap-0"
    >
      <CodeEditor
        value={content}
        language={language}
        readOnly
        ariaLabel="Content"
        headerStart={
          explanation && (
            <TabsList aria-label="Content view" className="group-data-horizontal/tabs:h-7">
              <TabsTrigger value="code" className="px-2.5 text-xs">
                Code
              </TabsTrigger>
              <TabsTrigger value="explain" className="px-2.5 text-xs">
                Explain
              </TabsTrigger>
            </TabsList>
          )
        }
        headerEnd={
          <ExplainCodeButton hasProAccess={hasProAccess} pending={pending} onClick={explain} />
        }
        renderBody={(editor) => (
          <>
            <TabsContent value="code">{editor}</TabsContent>
            {explanation && (
              <TabsContent
                value="explain"
                className={cn(
                  "max-h-100 overflow-y-auto px-4 py-3",
                  "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  pending && "opacity-60",
                )}
              >
                <div className="markdown-preview">
                  <MarkdownPreview value={explanation} />
                </div>
              </TabsContent>
            )}
          </>
        )}
      />
      <p aria-live="polite" className="sr-only">
        {pending ? "Explaining the code..." : explanation ? "Explanation ready" : ""}
      </p>
    </Tabs>
  );
}
