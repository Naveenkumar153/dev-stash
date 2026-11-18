import type { z } from "zod";

import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/plans";

/**
 * What server actions and API routes share for their `{ success, data, error }`
 * replies: per-field errors and the messages more than one of them returns.
 * Zod is a type-only import, so client components can use this module without
 * pulling Zod into their bundle.
 */

export type FieldErrors = Partial<Record<string, string>>;

/** The first message for each field, keyed by the field's name. */
export function getFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    fieldErrors[String(issue.path[0])] ??= issue.message;
  }
  return fieldErrors;
}

/** Returned when a request arrives without a valid session. */
export const SESSION_EXPIRED = "Your session has expired. Sign in again.";

export const ITEM_NOT_FOUND = "This item doesn't exist or has been deleted.";

export const FILE_NOT_FOUND = "This file doesn't exist or has been deleted.";

export const FOLDER_NOT_FOUND = "This folder doesn't exist or has been deleted.";

/** Loading an item's detail failed for a reason the user can't act on. */
export const ITEM_LOAD_FAILED = "Couldn't load this item. Please try again.";

/** Creating an item failed for a reason the user can't act on. */
export const ITEM_CREATE_FAILED = "Couldn't create this item. Please try again.";

/** Creating a collection failed for a reason the user can't act on. */
export const COLLECTION_CREATE_FAILED = "Couldn't create this collection. Please try again.";

/** A collection that isn't the user's, or was deleted while its page was open. */
export const COLLECTION_NOT_FOUND = "This collection doesn't exist or has been deleted.";

export const COLLECTION_UPDATE_FAILED = "Couldn't update this collection. Please try again.";

export const COLLECTION_DELETE_FAILED = "Couldn't delete this collection. Please try again.";

/** An item was saved into a collection that isn't the user's, or no longer exists. */
export const COLLECTIONS_NOT_FOUND = "One of these collections doesn't exist or has been deleted.";

/** Loading the Collections picker's options failed. */
export const COLLECTIONS_LOAD_FAILED = "Couldn't load your collections.";

/** Loading the command palette's items and collections failed. */
export const SEARCH_LOAD_FAILED = "Couldn't load your items and collections.";

/** Saving editor preferences failed for a reason the user can't act on. */
export const EDITOR_PREFERENCES_SAVE_FAILED = "Couldn't save your editor preferences. Please try again.";

/** Saving a favorite / unfavorite failed for a reason the user can't act on. */
export const FAVORITE_UPDATE_FAILED = "Couldn't update favorites. Please try again.";

/** Pinning / unpinning an item failed for a reason the user can't act on. */
export const PIN_UPDATE_FAILED = "Couldn't update the pin. Please try again.";

/** A Free account at its item cap tried to create another item. */
export const ITEM_LIMIT_REACHED = `You've reached the Free plan's limit of ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`;

/** A Free account at its collection cap tried to create another collection. */
export const COLLECTION_LIMIT_REACHED = `You've reached the Free plan's limit of ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;

/** A Free account tried a Pro-only feature (file and image uploads today). */
export const PRO_REQUIRED = "File and image uploads are a Pro feature.";

/** Starting Stripe Checkout failed for a reason the user can't act on. */
export const CHECKOUT_FAILED = "Couldn't start checkout. Please try again.";

/** Opening the Stripe Customer Portal failed for a reason the user can't act on. */
export const BILLING_PORTAL_FAILED = "Couldn't open billing. Please try again.";
