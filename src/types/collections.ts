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
