"use server";

import {
  COLLECTION_CREATE_FAILED,
  SESSION_EXPIRED,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import {
  createCollectionSchema,
  type CreateCollectionInput,
} from "@/lib/collection-schemas";
import { createCollection as createCollectionRecord } from "@/lib/db/collections";
import { getSessionUserId } from "@/lib/session";
import type { CreateCollectionResult } from "@/types/collections";

function failure(error: string, fieldErrors: FieldErrors = {}): CreateCollectionResult {
  return { success: false, data: null, error, fieldErrors };
}

/**
 * Creates a collection from the New Collection dialog for the signed-in user
 * and returns it as a card.
 */
export async function createCollection(
  data: CreateCollectionInput,
): Promise<CreateCollectionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  const parsed = createCollectionSchema.safeParse(data);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    const collection = await createCollectionRecord(userId, parsed.data);
    return { success: true, data: collection, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Creating collection failed", error);
    return failure(COLLECTION_CREATE_FAILED);
  }
}
