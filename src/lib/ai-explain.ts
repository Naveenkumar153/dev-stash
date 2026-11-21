import { AI_DATA_RULE } from "@/lib/ai-item";
import { getContentEditorKind } from "@/lib/item-types";

/**
 * Characters of code Explain accepts. Unlike tags and descriptions, longer
 * code is refused rather than cut: explaining part of a script would silently
 * leave out the rest.
 */
export const AI_EXPLAIN_LIMIT = 20_000;

export const EXPLAIN_TOO_LONG = `Explain works on code up to ${AI_EXPLAIN_LIMIT.toLocaleString("en-US")} characters.`;

export const EXPLAIN_NO_CODE = "There's no code to explain.";

export const EXPLAIN_WRONG_TYPE = "Only snippets and commands can be explained.";

/** Snippets and commands: the types shown in the code editor. */
export function canExplain(typeName: string): boolean {
  return getContentEditorKind(typeName) === "code";
}

/** The system instructions: a short Markdown explanation, with destructive commands flagged. */
export const EXPLAIN_INSTRUCTIONS = `You explain code that a developer saved in their personal knowledge base. Your explanation is shown in place of the code, in a small panel.

Write about 200 to 300 words of Markdown:
- Start with one or two sentences on what the code does overall.
- Then walk through how it works, as a short list of the key parts, referring to names with inline code.
- End with the key concepts, edge cases or pitfalls worth knowing, if any.
- For a shell command, explain each command, flag and argument, and clearly warn about anything destructive or irreversible.
- Use at most "###" headings, no tables, and don't repeat the whole code back. Short code blocks are fine when they help.
- Write in the language of the item's title and comments, or English if unclear.

${AI_DATA_RULE}`;

export interface ExplainableItem {
  typeName: string;
  title: string;
  language: string | null;
  content: string;
}

/** The item as delimited text: its type, language and title, then the whole code. */
export function buildExplainInput(item: ExplainableItem): string {
  const language = item.language ? ` language="${item.language}"` : "";

  return [
    `<item type="${item.typeName}"${language}>`,
    `<title>${item.title}</title>`,
    `<content>\n${item.content}\n</content>`,
    "</item>",
  ].join("\n");
}

/** A reply wrapped whole in a ```markdown fence, which would render as one code block. */
const WRAPPING_MARKDOWN_FENCE = /^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/i;

/**
 * The model's Markdown, trimmed and unwrapped from a whole-reply ```markdown
 * fence. Null when nothing is left.
 */
export function normalizeExplanation(text: string): string | null {
  const trimmed = text.trim();
  const unwrapped = trimmed.match(WRAPPING_MARKDOWN_FENCE)?.[1].trim() ?? trimmed;

  return unwrapped || null;
}
