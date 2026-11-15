import { z } from "zod";

import {
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
} from "@/lib/collections";

/** A collection id from a URL: checked before any query. */
export const collectionIdSchema = z.cuid();

/** New Collection: a name and an optional description, blank saved as null. */
export const createCollectionSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required")
    .max(COLLECTION_NAME_MAX_LENGTH, `Names can be up to ${COLLECTION_NAME_MAX_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(
      COLLECTION_DESCRIPTION_MAX_LENGTH,
      `Descriptions can be up to ${COLLECTION_DESCRIPTION_MAX_LENGTH} characters`,
    )
    .nullish()
    .transform((value) => value || null),
});

/** Edit collection: the same fields and rules as New Collection. */
export const updateCollectionSchema = createCollectionSchema;

/** What the New and Edit collection forms send. */
export type CollectionFormInput = z.input<typeof createCollectionSchema>;
export type CreateCollectionInput = CollectionFormInput;

/** The validated, normalized payload the queries write. */
export type CreateCollectionData = z.output<typeof createCollectionSchema>;
export type UpdateCollectionData = CreateCollectionData;
