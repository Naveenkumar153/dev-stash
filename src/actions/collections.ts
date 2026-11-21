"use server";

import { refresh } from "next/cache";

import {
  COLLECTION_CREATE_FAILED,
  COLLECTION_DELETE_FAILED,
  COLLECTION_LIMIT_REACHED,
  COLLECTION_NOT_FOUND,
  COLLECTION_UPDATE_FAILED,
  FAVORITE_UPDATE_FAILED,
  SESSION_EXPIRED,
  actionFailure,
  formFailure,
  runOwnedWrite,
  validationFailure,
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
  setCollectionFavorite as setCollectionFavoriteRecord,
  updateCollection as updateCollectionRecord,
} from "@/lib/db/collections";
import { getSessionUserId } from "@/lib/session";
import { wantedStateSchema } from "@/lib/toggle-schemas";
import { createCollectionWithinLimit, getSessionEntitlements } from "@/lib/usage-limits";
import type {
  CreateCollectionResult,
  DeleteCollectionResult,
  UpdateCollectionResult,
} from "@/types/collections";
import type { SetFavoriteResult } from "@/types/favorites";

/**
 * Creates a collection from the New Collection dialog for the signed-in user
 * and returns it as a card. A Free account at its collection limit (with
 * gating on) gets the limit error and nothing is written.
 */
export async function createCollection(
  data: CreateCollectionInput,
): Promise<CreateCollectionResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return formFailure(SESSION_EXPIRED);
  }
  const { userId, hasProAccess } = entitlements;

  const parsed = createCollectionSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    // The Free limit's count and the insert share one transaction.
    const created = await createCollectionWithinLimit(userId, hasProAccess, (db) =>
      createCollectionRecord(userId, parsed.data, db),
    );
    if (!created.allowed) {
      return formFailure(COLLECTION_LIMIT_REACHED);
    }
    refresh();
    return { success: true, data: created.value, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Creating collection failed", error);
    return formFailure(COLLECTION_CREATE_FAILED);
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
    return formFailure(SESSION_EXPIRED);
  }

  if (!collectionIdSchema.safeParse(collectionId).success) {
    return formFailure(COLLECTION_NOT_FOUND);
  }

  const parsed = updateCollectionSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    const collection = await updateCollectionRecord(userId, collectionId, parsed.data);
    if (!collection) {
      return formFailure(COLLECTION_NOT_FOUND);
    }
    refresh();
    return { success: true, data: collection, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Updating collection failed", error);
    return formFailure(COLLECTION_UPDATE_FAILED);
  }
}

/**
 * Deletes one of the signed-in user's collections. Its items stay; they just
 * leave the collection.
 */
export async function deleteCollection(collectionId: string): Promise<DeleteCollectionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  if (!collectionIdSchema.safeParse(collectionId).success) {
    return actionFailure(COLLECTION_NOT_FOUND);
  }

  const error = await runOwnedWrite(() => deleteCollectionRecord(userId, collectionId), {
    notFound: COLLECTION_NOT_FOUND,
    failed: COLLECTION_DELETE_FAILED,
    logLabel: "Deleting collection failed",
  });
  if (error) {
    return actionFailure(error);
  }

  // Re-renders the page and its layout in this same response, so the sidebar
  // and cards drop the collection even when the caller then navigates away:
  // a router.refresh() right after router.replace() cancels the navigation.
  refresh();
  return { success: true, data: { id: collectionId }, error: null };
}

/**
 * Favorites or unfavorites one of the signed-in user's collections. On success
 * the page and its layout re-render in this response, so the cards, the
 * sidebar's Favorites and /favorites follow.
 */
export async function setCollectionFavorite(
  collectionId: string,
  isFavorite: boolean,
): Promise<SetFavoriteResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  if (!collectionIdSchema.safeParse(collectionId).success) {
    return actionFailure(COLLECTION_NOT_FOUND);
  }

  const parsed = wantedStateSchema.safeParse(isFavorite);
  if (!parsed.success) {
    return actionFailure(FAVORITE_UPDATE_FAILED);
  }

  const error = await runOwnedWrite(
    () => setCollectionFavoriteRecord(userId, collectionId, parsed.data),
    {
      notFound: COLLECTION_NOT_FOUND,
      failed: FAVORITE_UPDATE_FAILED,
      logLabel: "Updating collection favorite failed",
    },
  );
  if (error) {
    return actionFailure(error);
  }

  refresh();
  return { success: true, data: { id: collectionId, isFavorite: parsed.data }, error: null };
}
