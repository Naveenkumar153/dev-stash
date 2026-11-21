import { z } from "zod";

import { AI_NEEDS_INPUT, hasAiInput } from "@/lib/ai-item";
import { MAX_FILE_NAME_LENGTH } from "@/lib/file-upload";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { CREATABLE_ITEM_TYPES } from "@/lib/item-types";

/** Optional text with the item form's own cap, trimmed and blank by default. */
const text = (max: number) => z.string().trim().max(max).default("");

/**
 * The New Item / edit form's draft, as the AI actions read it (tag
 * suggestions and descriptions). The same caps as the item schemas, so
 * anything the form can hold passes; the content is cut to `AI_CONTENT_LIMIT`
 * when the prompt is built. It needs something to read: a title, content, a
 * URL or a file name.
 */
export const aiDraftSchema = z
  .object({
    // Any string in, so the drawer can pass its item's type as it is; only
    // the creatable types pass.
    typeName: z.string().pipe(z.enum(CREATABLE_ITEM_TYPES, { error: "Choose an item type" })),
    title: text(ITEM_LIMITS.title),
    description: text(ITEM_LIMITS.description),
    content: z.string().max(ITEM_LIMITS.content).default(""),
    url: text(ITEM_LIMITS.url),
    language: text(ITEM_LIMITS.language),
    fileName: text(MAX_FILE_NAME_LENGTH),
    tags: z
      .array(z.string().trim().max(ITEM_LIMITS.tag))
      .max(ITEM_LIMITS.tagCount)
      .default([]),
  })
  .refine(hasAiInput, {
    message: AI_NEEDS_INPUT,
    path: ["title"],
  });

/** What the form sends. */
export type AiDraftInput = z.input<typeof aiDraftSchema>;
