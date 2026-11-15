"use server";

import { refresh } from "next/cache";

import {
  COLLECTION_CREATE_FAILED,
  COLLECTION_DELETE_FAILED,
  COLLECTION_NOT_FOUND,
  COLLECTION_UPDATE_FAILED,
  SESSION_EXPIRED,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import {
  collectionIdSchema,
  createCollectionSchema,
  updateCollectionSchema,
  type CollectionFormInput,
  type CreateCollectionInput,
} from "@/lib/collection-schemas";
import {
  createCollection as createCollectionRecord,
  deleteCollection as deleteCollectionRecord,
  updateCollection as updateCollectionRecord,
} from "@/lib/db/collections";
import { getSessionUserId } from "@/lib/session";
import type {
  CreateCollectionResult,
  DeleteCollectionResult,
  UpdateCollectionResult,
} from "@/types/collections";

function failure(error: string, fieldErrors: FieldErrors = {}): CreateCollectionResult {
  return { success: false, data: null, error, fieldErrors };
}

function updateFailure(error: string, fieldErrors: FieldErrors = {}): UpdateCollectionResult {
  return { success: false, data: null, error, fieldErrors };
}

function deleteFailure(error: string): DeleteCollectionResult {
  return { success: false, data: null, error };
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

/**
 * Saves the Edit collection dialog's name and description, for a collection
 * the signed-in user owns.
 */
export async function updateCollection(
  collectionId: string,
  data: CollectionFormInput,
): Promise<UpdateCollectionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return updateFailure(SESSION_EXPIRED);
  }

  if (!collectionIdSchema.safeParse(collectionId).success) {
    return updateFailure(COLLECTION_NOT_FOUND);
  }

  const parsed = updateCollectionSchema.safeParse(data);
  if (!parsed.success) {
    return updateFailure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    const collection = await updateCollectionRecord(userId, collectionId, parsed.data);
    return collection
      ? { success: true, data: collection, error: null, fieldErrors: {} }
      : updateFailure(COLLECTION_NOT_FOUND);
  } catch (error) {
    console.error("Updating collection failed", error);
    return updateFailure(COLLECTION_UPDATE_FAILED);
  }
}

/**
 * Deletes one of the signed-in user's collections. Its items stay; they just
 * leave the collection.
 */
export async function deleteCollection(collectionId: string): Promise<DeleteCollectionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return deleteFailure(SESSION_EXPIRED);
  }

  if (!collectionIdSchema.safeParse(collectionId).success) {
    return deleteFailure(COLLECTION_NOT_FOUND);
  }

  try {
    if (!(await deleteCollectionRecord(userId, collectionId))) {
      return deleteFailure(COLLECTION_NOT_FOUND);
    }
  } catch (error) {
    console.error("Deleting collection failed", error);
    return deleteFailure(COLLECTION_DELETE_FAILED);
  }

  // Re-renders the page and its layout in this same response, so the sidebar
  // and cards drop the collection even when the caller then navigates away:
  // a router.refresh() right after router.replace() cancels the navigation.
  refresh();
  return { success: true, data: { id: collectionId }, error: null };
}
