import { z } from "zod";

import { folderIdSchema } from "@/lib/folder-schemas";
import { FILE_ITEM_TYPES, NON_FILE_ITEM_TYPES, requiresUrl } from "@/lib/item-types";

/** A link saved, or edited, without its URL. */
export const URL_REQUIRED = "URL is required";

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
 * The collections an item goes in, each kept once in the order given. Empty is
 * fine: an item needn't be in any. Whether they're the user's is checked
 * against the database by the caller.
 */
const collectionIdsSchema = z
  .array(z.cuid({ error: "Choose collections from the list" }), {
    error: "Choose collections from the list",
  })
  .transform((ids) => [...new Set(ids)]);

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
  /** Replaces the item's collections on save, so it's required, not defaulted. */
  collectionIds: collectionIdsSchema,
});

/** What the edit form sends. */
export type UpdateItemInput = z.input<typeof updateItemSchema>;

/** The validated, normalized payload the query writes. */
export type UpdateItemData = z.output<typeof updateItemSchema>;

/**
 * The New Item dialog's payload for a typed-in item: the edit fields plus the
 * type, which must be one of the non-file system types - file and image items
 * go through the upload route instead. A link needs its URL; for every other
 * type `createItem` drops the URL, like the fields the type doesn't use.
 */
export const createItemSchema = updateItemSchema
  .extend({
    typeName: z.enum(NON_FILE_ITEM_TYPES, { error: "Choose an item type" }),
  })
  .refine((data) => !requiresUrl(data.typeName) || data.url !== null, {
    message: URL_REQUIRED,
    path: ["url"],
  });

/** What the New Item dialog sends. */
export type CreateItemInput = z.input<typeof createItemSchema>;

/** The validated, normalized payload the create query writes. */
export type CreateItemData = z.output<typeof createItemSchema>;

/**
 * The fields sent alongside an upload to `POST /api/items/upload`. File items
 * carry no text payload, so only the shared fields, the collections, the type
 * and the folder are read. Only files go in folders; a blank folder means the top level.
 */
export const createFileItemSchema = updateItemSchema
  .pick({ title: true, description: true, tags: true, collectionIds: true })
  .extend({
    typeName: z.enum(FILE_ITEM_TYPES, { error: "Choose an item type" }),
    folderId: optionalText.pipe(folderIdSchema.nullable()),
  })
  .refine((data) => data.folderId === null || data.typeName === "file", {
    message: "Only files can go in folders",
    path: ["folderId"],
  });

/** What the upload form sends besides the file. */
export type CreateFileItemInput = z.input<typeof createFileItemSchema>;

/** The validated, normalized fields the file-item query writes. */
export type CreateFileItemData = z.output<typeof createFileItemSchema>;
