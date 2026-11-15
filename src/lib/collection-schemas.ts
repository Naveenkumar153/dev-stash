import { z } from "zod";

import {
  COLLECTION_DESCRIPTION_MAX_LENGTH,
  COLLECTION_NAME_MAX_LENGTH,
} from "@/lib/collections";

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

/** What the New Collection form sends. */
export type CreateCollectionInput = z.input<typeof createCollectionSchema>;

/** The validated, normalized payload the query writes. */
export type CreateCollectionData = z.output<typeof createCollectionSchema>;
