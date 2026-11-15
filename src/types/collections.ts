import type { FieldErrors } from "@/lib/action-result";
import type { CollectionSummary } from "@/lib/db/collections";

/** Result of the `createCollection` server action: the new collection, or why it wasn't created. */
export interface CreateCollectionResult {
  success: boolean;
  data: CollectionSummary | null;
  error: string | null;
  /** The first validation message for each invalid field, keyed by field name. */
  fieldErrors: FieldErrors;
}

/** A collection as the item forms' Collections picker lists it. */
export interface CollectionOption {
  id: string;
  name: string;
}

/** Body returned by `GET /api/collections`. */
export interface CollectionOptionsResponse {
  success: boolean;
  data: CollectionOption[] | null;
  error: string | null;
}
