import { AI_DATA_RULE, formatItemForAi, type AiItemDraft } from "@/lib/ai-item";
import { ITEM_LIMITS } from "@/lib/item-limits";

/** Most suggestions returned at once. */
export const MAX_TAG_SUGGESTIONS = 5;

/**
 * The system instructions. The reply is parsed by hand (`parseTagReply`),
 * since structured outputs cost this model far more tokens.
 */
export const TAG_INSTRUCTIONS = `You suggest tags for one item in a developer's personal knowledge base of snippets, prompts, commands, notes, links and files.

Return 3 to 5 tags that would help the owner find this item again: the languages, frameworks, libraries, tools and topics it is about.
- Lowercase, one to three words joined by hyphens: "react", "code-review", "docker-compose".
- Skip tags the item already has, and generic words like "code", "snippet", "note", "misc" or "programming".

Reply with JSON only, in the form {"tags": ["tag-one", "tag-two"]}.

${AI_DATA_RULE}`;

/**
 * The request's opening line. OpenAI refuses `json_object` mode unless the
 * word "JSON" is in the input itself, not just the instructions.
 */
export const TAG_INPUT_PREAMBLE = 'Suggest tags for this item. Reply in JSON: {"tags": [...]}.';

/** The JSON preamble, then the item as delimited text (`formatItemForAi`). */
export function buildTagInput(draft: AiItemDraft): string {
  return `${TAG_INPUT_PREAMBLE}\n${formatItemForAi(draft)}`;
}

/**
 * The tag names in the model's JSON reply, which may be `{"tags": [...]}` or
 * a bare `[...]`. Non-string entries are dropped. Null when the reply isn't
 * JSON in either shape.
 */
export function parseTagReply(reply: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return null;
  }

  const list =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as { tags?: unknown }).tags
      : parsed;

  if (!Array.isArray(list)) {
    return null;
  }

  return list.filter((tag): tag is string => typeof tag === "string");
}

/** "React Hooks" -> "react-hooks", "#TypeScript" -> "typescript"; keeps c++, c# and node.js. */
export function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}+#.-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, ITEM_LIMITS.tag);
}

/**
 * The model's tags made safe to offer: normalized, each once, none the item
 * already has (ignoring case), and no more than fit under the 20-tag limit.
 */
export function normalizeTagSuggestions(suggested: string[], current: string[]): string[] {
  const room = Math.max(0, Math.min(MAX_TAG_SUGGESTIONS, ITEM_LIMITS.tagCount - current.length));
  const taken = new Set(current.map((tag) => tag.trim().toLowerCase()));
  const tags: string[] = [];

  for (const name of suggested) {
    if (tags.length >= room) {
      break;
    }
    const tag = normalizeTagName(name);
    if (tag && !taken.has(tag)) {
      taken.add(tag);
      tags.push(tag);
    }
  }

  return tags;
}
