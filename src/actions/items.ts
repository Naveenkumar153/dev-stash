"use server";

import { refresh } from "next/cache";

import {
  COLLECTIONS_NOT_FOUND,
  CONTENT_SAVE_FAILED,
  FAVORITE_UPDATE_FAILED,
  ITEM_CREATE_FAILED,
  ITEM_DELETE_FAILED,
  ITEM_LIMIT_REACHED,
  ITEM_NOT_FOUND,
  ITEM_TYPE_UNAVAILABLE,
  ITEM_UPDATE_FAILED,
  PIN_UPDATE_FAILED,
  SESSION_EXPIRED,
  actionFailure,
  formFailure,
  runOwnedWrite,
  validationFailure,
} from "@/lib/action-result";
import { ownsCollections } from "@/lib/db/collections";
import {
  createItem as createItemRecord,
  deleteItem as deleteItemRecord,
  setItemFavorite as setItemFavoriteRecord,
  setItemContent as setItemContentRecord,
  setItemPinned,
  updateItem as updateItemRecord,
} from "@/lib/db/item-writes";
import {
  createItemSchema,
  URL_REQUIRED,
  itemContentSchema,
  itemIdSchema,
  updateItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/item-schemas";
import { getSessionUserId } from "@/lib/session";
import { getThumbnailKey } from "@/lib/file-upload";
import { discardStoredFiles } from "@/lib/stored-files";
import { wantedStateSchema } from "@/lib/toggle-schemas";
import { createItemWithinLimit, getSessionEntitlements } from "@/lib/usage-limits";
import type { SetFavoriteResult } from "@/types/favorites";
import type {
  CreateItemResult,
  DeleteItemResult,
  SetItemContentResult,
  ToggleItemPinResult,
  UpdateItemResult,
} from "@/types/items";

/** Shown on the Collections field when one of them isn't the user's. */
const collectionsFailure = () =>
  formFailure(COLLECTIONS_NOT_FOUND, { collectionIds: COLLECTIONS_NOT_FOUND });

/**
 * Creates an item from the New Item dialog for the signed-in user and returns
 * it. The type must be one of the creatable system types; fields that type
 * doesn't use are dropped by the query. A Free account at its item limit (with
 * gating on) and a collection that isn't the user's both leave nothing written.
 */
export async function createItem(data: CreateItemInput): Promise<CreateItemResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return formFailure(SESSION_EXPIRED);
  }
  const { userId, hasProAccess } = entitlements;

  const parsed = createItemSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      return collectionsFailure();
    }

    // The Free limit's count and the insert share one transaction.
    const created = await createItemWithinLimit(userId, hasProAccess, (db) =>
      createItemRecord(userId, parsed.data, db),
    );
    if (!created.allowed) {
      return formFailure(ITEM_LIMIT_REACHED);
    }
    if (!created.value) {
      return formFailure(ITEM_TYPE_UNAVAILABLE);
    }

    refresh();
    return { success: true, data: created.value, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Creating item failed", error);
    return formFailure(ITEM_CREATE_FAILED);
  }
}

/**
 * Saves the item drawer's edits and returns the saved item, so the drawer can
 * show it without fetching again. Only the signed-in user's own items can be
 * saved: the write is scoped to the session's user, so anyone else's item
 * fails like a missing one.
 */
export async function updateItem(
  itemId: string,
  data: UpdateItemInput,
): Promise<UpdateItemResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return formFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return formFailure(ITEM_NOT_FOUND);
  }

  const parsed = updateItemSchema.safeParse(data);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  try {
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      return collectionsFailure();
    }

    const outcome = await updateItemRecord(itemId, userId, parsed.data);
    if (outcome.status === "not-found") {
      return formFailure(ITEM_NOT_FOUND);
    }
    if (outcome.status === "url-required") {
      return formFailure(URL_REQUIRED, { url: URL_REQUIRED });
    }

    refresh();
    return { success: true, data: outcome.item, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Updating item failed", error);
    return formFailure(ITEM_UPDATE_FAILED);
  }
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
    return actionFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  let deleted;
  try {
    deleted = await deleteItemRecord(itemId, userId);
  } catch (error) {
    console.error("Deleting item failed", error);
    return actionFailure(ITEM_DELETE_FAILED);
  }

  if (!deleted) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  // The row is already gone, so a failure here only leaves an unreachable file.
  if (deleted.fileKey) {
    // The thumbnail too, if the item was an image; deleting a missing key is a no-op.
    await discardStoredFiles([deleted.fileKey, getThumbnailKey(deleted.fileKey)]);
  }

  refresh();
  return { success: true, data: { id: itemId }, error: null };
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
    return actionFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  const parsed = wantedStateSchema.safeParse(isFavorite);
  if (!parsed.success) {
    return actionFailure(FAVORITE_UPDATE_FAILED);
  }

  const error = await runOwnedWrite(() => setItemFavoriteRecord(userId, itemId, parsed.data), {
    notFound: ITEM_NOT_FOUND,
    failed: FAVORITE_UPDATE_FAILED,
    logLabel: "Updating item favorite failed",
  });
  if (error) {
    return actionFailure(error);
  }

  refresh();
  return { success: true, data: { id: itemId, isFavorite: parsed.data }, error: null };
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
    return actionFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  const parsed = wantedStateSchema.safeParse(isPinned);
  if (!parsed.success) {
    return actionFailure(PIN_UPDATE_FAILED);
  }

  const error = await runOwnedWrite(() => setItemPinned(userId, itemId, parsed.data), {
    notFound: ITEM_NOT_FOUND,
    failed: PIN_UPDATE_FAILED,
    logLabel: "Updating item pin failed",
  });
  if (error) {
    return actionFailure(error);
  }

  refresh();
  return { success: true, data: { id: itemId, isPinned: parsed.data }, error: null };
}

/**
 * Replaces an item's content and nothing else, for the drawer's "Use updated
 * prompt" and its Undo. The content is saved exactly as given. Refreshes the
 * pages behind the drawer so card previews follow.
 */
export async function setItemContent(
  itemId: string,
  content: string,
): Promise<SetItemContentResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  const parsed = itemContentSchema.safeParse(content);
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0].message);
  }

  let saved: Awaited<ReturnType<typeof setItemContentRecord>>;
  try {
    saved = await setItemContentRecord(userId, itemId, parsed.data);
  } catch (error) {
    console.error("Saving item content failed", error);
    return actionFailure(CONTENT_SAVE_FAILED);
  }
  if (!saved) {
    return actionFailure(ITEM_NOT_FOUND);
  }

  refresh();
  return {
    success: true,
    data: { id: itemId, content: saved.content, updatedAt: saved.updatedAt.toISOString() },
    error: null,
  };
}
