"use client";

import { Field } from "@/components/forms/Field";
import { CodeEditor } from "@/components/items/CodeEditor";
import { MarkdownEditor } from "@/components/items/MarkdownEditor";
import { Textarea } from "@/components/ui/textarea";
import type { ContentEditorKind } from "@/lib/item-types";

interface ItemContentFieldProps {
  id: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Which editor the field uses: code, markdown or a plain textarea. */
  editor: ContentEditorKind;
  /** The snippet or command's language, which the code editor highlights. */
  language: string;
}

/** The Content field: the code editor, the Markdown editor or a plain textarea, by type. */
export function ItemContentField({
  id,
  error,
  value,
  onChange,
  editor,
  language,
}: Readonly<ItemContentFieldProps>) {
  return (
    <Field id={id} error={error} label="Content">
      {(control) => {
        if (editor === "code") {
          return (
            <CodeEditor
              value={value}
              language={language}
              onChange={onChange}
              ariaLabel="Content"
              invalid={control["aria-invalid"]}
            />
          );
        }

        if (editor === "markdown") {
          return (
            <MarkdownEditor
              id={control.id}
              describedBy={control["aria-describedby"]}
              value={value}
              onChange={onChange}
              ariaLabel="Content"
              invalid={control["aria-invalid"]}
            />
          );
        }

        return (
          <Textarea
            {...control}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck={false}
            className="min-h-40 font-mono text-[13px] leading-relaxed"
          />
        );
      }}
    </Field>
  );
}
