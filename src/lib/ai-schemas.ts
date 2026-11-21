import { z } from "zod";

import { AI_TAGS_NEED_INPUT } from "@/lib/ai-tags";
import { ITEM_LIMITS } from "@/lib/item-limits";
import { CREATABLE_ITEM_TYPES } from "@/lib/item-types";

/** Optional text with the item form's own cap, trimmed and blank by default. */
const text = (max: number) => z.string().trim().max(max).default("");

/**
 * The New Item / edit form's draft, as `generateAutoTags` reads it. The same
 * caps as the item schemas, so anything the form can hold passes; the content
 * is cut to `AI_TAG_CONTENT_LIMIT` when the prompt is built.
 */
export const autoTagInputSchema = z
  .object({
    // Any string in, so the drawer can pass its item's type as it is; only
    // the creatable types pass.
    typeName: z.string().pipe(z.enum(CREATABLE_ITEM_TYPES, { error: "Choose an item type" })),
    title: text(ITEM_LIMITS.title),
    description: text(ITEM_LIMITS.description),
    content: z.string().max(ITEM_LIMITS.content).default(""),
    url: text(ITEM_LIMITS.url),
    language: text(ITEM_LIMITS.language),
    tags: z
      .array(z.string().trim().max(ITEM_LIMITS.tag))
      .max(ITEM_LIMITS.tagCount)
      .default([]),
  })
  .refine((draft) => draft.title || draft.content.trim(), {
    message: AI_TAGS_NEED_INPUT,
    path: ["title"],
  });

/** What the form sends. */
export type AutoTagInput = z.input<typeof autoTagInputSchema>;
