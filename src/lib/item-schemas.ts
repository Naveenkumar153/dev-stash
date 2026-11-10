import { z } from "zod";

/** Item ids are Prisma cuids, so anything else can't match a row. */
export const itemIdSchema = z.cuid();

/** Optional text: trimmed, with a blank value saved as null. */
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

/**
 * Optional content, kept exactly as typed - indentation and trailing newlines
 * matter in code - but saved as null when it's only whitespace.
 */
const optionalContent = z
  .string()
  .nullish()
  .transform((value) => (value?.trim() ? value : null));

/**
 * Optional link, http or https only. `z.url()` alone accepts any scheme,
 * `javascript:` included, while `z.httpUrl()` also rejects localhost and IP
 * addresses, which developers do save links to.
 */
const optionalUrl = optionalText.pipe(
  z.url({ protocol: /^https?$/, error: "Enter a full URL starting with http:// or https://" }).nullable(),
);

/** Tag names, trimmed and non-blank, each kept once in the order given. */
const tagsSchema = z
  .array(z.string().trim().min(1, "Tags can't be blank"), { error: "Tags are required" })
  .transform((tags) => [...new Set(tags)]);

/**
 * The item drawer's edit payload. Fields that don't apply to the item's type
 * are still validated here; `updateItem` decides which ones it writes.
 */
export const updateItemSchema = z.object({
  title: z.string({ error: "Title is required" }).trim().min(1, "Title is required"),
  description: optionalText,
  content: optionalContent,
  language: optionalText,
  url: optionalUrl,
  tags: tagsSchema,
});

/** What the edit form sends. */
export type UpdateItemInput = z.input<typeof updateItemSchema>;

/** The validated, normalized payload the query writes. */
export type UpdateItemData = z.output<typeof updateItemSchema>;

/**
 * The edit form's comma-separated tags as names: trimmed, blanks dropped and
 * each kept once, in the order typed. "react, hooks, , react" -> ["react", "hooks"]
 */
export function parseTagInput(input: string): string[] {
  const names = input
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return [...new Set(names)];
}
