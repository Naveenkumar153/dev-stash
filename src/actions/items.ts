"use server";

import { refresh } from "next/cache";

import {
  COLLECTIONS_NOT_FOUND,
  FAVORITE_UPDATE_FAILED,
  ITEM_CREATE_FAILED,
  ITEM_LIMIT_REACHED,
  ITEM_NOT_FOUND,
  PIN_UPDATE_FAILED,
  SESSION_EXPIRED,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import { ownsCollections } from "@/lib/db/collections";
import {
  createItem as createItemRecord,
  deleteItem as deleteItemRecord,
  setItemFavorite as setItemFavoriteRecord,
  setItemPinned,
  updateItem as updateItemRecord,
} from "@/lib/db/items";
import { isFavoriteSchema } from "@/lib/favorite-schemas";
import {
  createItemSchema,
  URL_REQUIRED,
  isPinnedSchema,
  itemIdSchema,
  updateItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/item-schemas";
import { getSessionUserId } from "@/lib/session";
import { discardStoredFiles } from "@/lib/stored-files";
import { canCreateItem, getSessionEntitlements } from "@/lib/usage-limits";
import type { SetFavoriteResult } from "@/types/favorites";
import type {
  CreateItemResult,
  DeleteItemResult,
  ToggleItemPinResult,
  UpdateItemResult,
} from "@/types/items";

function failure(error: string, fieldErrors: FieldErrors = {}): UpdateItemResult {
  return { success: false, data: null, error, fieldErrors };
}

/** Shown on the Collections field when one of them isn't the user's. */
const collectionsFailure = () =>
  failure(COLLECTIONS_NOT_FOUND, { collectionIds: COLLECTIONS_NOT_FOUND });

/**
 * Creates an item from the New Item dialog for the signed-in user and returns
 * it. The type must be one of the creatable system types; fields that type
 * doesn't use are dropped by the query. A Free account at its item limit (with
 * gating on) and a collection that isn't the user's both leave nothing written.
 */
export async function createItem(data: CreateItemInput): Promise<CreateItemResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return failure(SESSION_EXPIRED);
  }
  const { userId, hasProAccess } = entitlements;

  const parsed = createItemSchema.safeParse(data);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    if (!(await canCreateItem(userId, hasProAccess)).allowed) {
      return failure(ITEM_LIMIT_REACHED);
    }
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      return collectionsFailure();
    }

    const item = await createItemRecord(userId, parsed.data);
    if (!item) {
      return failure("This item type isn't available.");
    }

    return { success: true, data: item, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Creating item failed", error);
    return failure(ITEM_CREATE_FAILED);
  }
}

/**
 * Saves the item drawer's edits and returns the saved item, so the drawer can
 * show it without fetching again. Only the signed-in user's own items can be
 * saved: the write is scoped to the session's user, so anyone else's item -
 * including the demo items every account still sees - fails like a missing one.
 */
export async function updateItem(
  itemId: string,
  data: UpdateItemInput,
): Promise<UpdateItemResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return failure(ITEM_NOT_FOUND);
  }

  const parsed = updateItemSchema.safeParse(data);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      return collectionsFailure();
    }

    const outcome = await updateItemRecord(itemId, userId, parsed.data);
    if (outcome.status === "not-found") {
      return failure(ITEM_NOT_FOUND);
    }
    if (outcome.status === "url-required") {
      return failure(URL_REQUIRED, { url: URL_REQUIRED });
    }

    return { success: true, data: outcome.item, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Updating item failed", error);
    return failure("Couldn't save your changes. Please try again.");
  }
}

function deleteFailure(error: string): DeleteItemResult {
  return { success: false, data: null, error };
}

/**
 * Permanently deletes one of the signed-in user's items, and its file from R2
 * for a file or image item. Like `updateItem`, the delete is scoped to the
 * session's user, so anyone else's item fails like a missing one. The row goes
 * first, so a failure can never leave an item pointing at a missing file.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return deleteFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return deleteFailure(ITEM_NOT_FOUND);
  }

  let deleted;
  try {
    deleted = await deleteItemRecord(itemId, userId);
  } catch (error) {
    console.error("Deleting item failed", error);
    return deleteFailure("Couldn't delete this item. Please try again.");
  }

  if (!deleted) {
    return deleteFailure(ITEM_NOT_FOUND);
  }

  // The row is already gone, so a failure here only leaves an unreachable file.
  if (deleted.fileKey) {
    await discardStoredFiles([deleted.fileKey]);
  }

  return { success: true, data: { id: itemId }, error: null };
}

function favoriteFailure(error: string): SetFavoriteResult {
  return { success: false, data: null, error };
}

/**
 * Favorites or unfavorites one of the signed-in user's items. Scoped to the
 * session's user like `updateItem`, so anyone else's item fails like a missing
 * one. On success the page and its layout re-render in this response, so the
 * cards and /favorites follow.
 */
export async function setItemFavorite(
  itemId: string,
  isFavorite: boolean,
): Promise<SetFavoriteResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return favoriteFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return favoriteFailure(ITEM_NOT_FOUND);
  }

  const parsed = isFavoriteSchema.safeParse(isFavorite);
  if (!parsed.success) {
    return favoriteFailure(FAVORITE_UPDATE_FAILED);
  }

  try {
    if (!(await setItemFavoriteRecord(userId, itemId, parsed.data))) {
      return favoriteFailure(ITEM_NOT_FOUND);
    }
  } catch (error) {
    console.error("Updating item favorite failed", error);
    return favoriteFailure(FAVORITE_UPDATE_FAILED);
  }

  refresh();
  return { success: true, data: { id: itemId, isFavorite: parsed.data }, error: null };
}

function pinFailure(error: string): ToggleItemPinResult {
  return { success: false, data: null, error };
}

/**
 * Pins or unpins one of the signed-in user's items. Takes the wanted state
 * rather than flipping it, so a double click or two tabs can't invert each
 * other. Scoped to the session's user like `setItemFavorite`; on success the
 * page and its layout re-render in this response, so the dashboard's Pinned
 * section and the lists' pinned-first order follow.
 */
export async function toggleItemPin(
  itemId: string,
  isPinned: boolean,
): Promise<ToggleItemPinResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return pinFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return pinFailure(ITEM_NOT_FOUND);
  }

  const parsed = isPinnedSchema.safeParse(isPinned);
  if (!parsed.success) {
    return pinFailure(PIN_UPDATE_FAILED);
  }

  try {
    if (!(await setItemPinned(userId, itemId, parsed.data))) {
      return pinFailure(ITEM_NOT_FOUND);
    }
  } catch (error) {
    console.error("Updating item pin failed", error);
    return pinFailure(PIN_UPDATE_FAILED);
  }

  refresh();
  return { success: true, data: { id: itemId, isPinned: parsed.data }, error: null };
}
