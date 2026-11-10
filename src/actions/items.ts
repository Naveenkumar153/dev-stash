"use server";

import { auth } from "@/auth";
import { getFieldErrors, type FieldErrors } from "@/lib/auth-schemas";
import {
  deleteItem as deleteItemRecord,
  updateItem as updateItemRecord,
} from "@/lib/db/items";
import { itemIdSchema, updateItemSchema, type UpdateItemInput } from "@/lib/item-schemas";
import type { DeleteItemResult, UpdateItemResult } from "@/types/items";

const NOT_FOUND = "This item doesn't exist or has been deleted.";
const SESSION_EXPIRED = "Your session has expired. Sign in again.";

function failure(error: string, fieldErrors: FieldErrors = {}): UpdateItemResult {
  return { success: false, data: null, error, fieldErrors };
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
  const session = await auth();
  if (!session?.user?.id) {
    return failure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return failure(NOT_FOUND);
  }

  const parsed = updateItemSchema.safeParse(data);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    const item = await updateItemRecord(itemId, session.user.id, parsed.data);
    if (!item) {
      return failure(NOT_FOUND);
    }

    return { success: true, data: item, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Updating item failed", error);
    return failure("Couldn't save your changes. Please try again.");
  }
}

function deleteFailure(error: string): DeleteItemResult {
  return { success: false, data: null, error };
}

/**
 * Permanently deletes one of the signed-in user's items. Like `updateItem`,
 * the delete is scoped to the session's user, so anyone else's item fails like
 * a missing one.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return deleteFailure(SESSION_EXPIRED);
  }

  if (!itemIdSchema.safeParse(itemId).success) {
    return deleteFailure(NOT_FOUND);
  }

  try {
    const deleted = await deleteItemRecord(itemId, session.user.id);
    if (!deleted) {
      return deleteFailure(NOT_FOUND);
    }

    return { success: true, data: { id: itemId }, error: null };
  } catch (error) {
    console.error("Deleting item failed", error);
    return deleteFailure("Couldn't delete this item. Please try again.");
  }
}
