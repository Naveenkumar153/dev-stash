import { AI_DATA_RULE, formatItemForAi, type AiItemDraft } from "@/lib/ai-item";
import { ITEM_LIMITS } from "@/lib/item-limits";

/**
 * The system instructions. Links, files and images are described from what
 * the form holds (title, URL or file name, tags): the model can't open the
 * page or the file, so it's told not to guess at their contents.
 */
export const DESCRIPTION_INSTRUCTIONS = `You write the description for one item in a developer's personal knowledge base of snippets, prompts, commands, notes, links and files. It appears under the item's title on its card.

Write one or two plain sentences, at most 200 characters, saying what the item is and when it's useful.
- Start with what it does or covers ("Debounces a value...", "Guide to..."), not "This snippet..." or "This item...".
- No Markdown, no quotes, no lists. Write in the language of the item's own text.
- For a link, file or image you only see its title, URL or file name and tags: describe it from those, without inventing details of the page or file.

Reply with JSON only, in the form {"description": "..."}.

${AI_DATA_RULE}`;

/**
 * The request's opening line. OpenAI refuses `json_object` mode unless the
 * word "JSON" is in the input itself, not just the instructions.
 */
export const DESCRIPTION_INPUT_PREAMBLE =
  'Write a description for this item. Reply in JSON: {"description": "..."}.';

/** The JSON preamble, then the item as delimited text (`formatItemForAi`). */
export function buildDescriptionInput(draft: AiItemDraft): string {
  return `${DESCRIPTION_INPUT_PREAMBLE}\n${formatItemForAi(draft)}`;
}

/**
 * The description in the model's JSON reply: `{"description": "..."}`, or a
 * bare JSON string. Null when the reply is neither, or the text is blank.
 */
export function parseDescriptionReply(reply: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return null;
  }

  const text =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { description?: unknown }).description
      : parsed;

  return typeof text === "string" && text.trim() ? text : null;
}

/** A quote at the start and a quote at the end; an apostrophe at the end alone ("teams'") stays. */
const WRAPPING_QUOTES = /^["'“‘](.*)["'”’]$/;

/**
 * One line of plain text that fits the Description field: whitespace
 * collapsed, quotes wrapping the whole text removed, capped at the field's limit.
 */
export function normalizeDescription(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  const unwrapped = line.match(WRAPPING_QUOTES)?.[1].trim() ?? line;

  return unwrapped.slice(0, ITEM_LIMITS.description);
}
