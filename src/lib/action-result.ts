import type { z } from "zod";

import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT, STORAGE_QUOTA_BYTES } from "@/lib/plans";

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

/** The failure half of every `{ success, data, error }` reply. */
export interface ActionFailure {
  success: false;
  data: null;
  error: string;
}

/** A failure for a form's reply, which also carries per-field errors. */
export interface FormFailure extends ActionFailure {
  fieldErrors: FieldErrors;
}

export function actionFailure(error: string): ActionFailure {
  return { success: false, data: null, error };
}

export function formFailure(error: string, fieldErrors: FieldErrors = {}): FormFailure {
  return { success: false, data: null, error, fieldErrors };
}

/** A form failure from a failed `safeParse`: its first message, plus each field's. */
export function validationFailure(error: z.ZodError): FormFailure {
  return formFailure(error.issues[0].message, getFieldErrors(error));
}

interface OwnedWriteMessages {
  /** When the write matched nothing: the row is missing or someone else's. */
  notFound: string;
  /** When the write threw. */
  failed: string;
  /** Names the write in the error log. */
  logLabel: string;
}

/**
 * Runs a write scoped to the user's own row (`write` resolves false when it
 * matched nothing) and returns the message to show, or null when it saved.
 * The caller keeps its own session and id checks, and refreshes on success.
 */
export async function runOwnedWrite(
  write: () => Promise<boolean>,
  { notFound, failed, logLabel }: OwnedWriteMessages,
): Promise<string | null> {
  try {
    return (await write()) ? null : notFound;
  } catch (error) {
    console.error(logLabel, error);
    return failed;
  }
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

/** The system type for a new item is missing from the database. */
export const ITEM_TYPE_UNAVAILABLE = "This item type isn't available.";

/** Saving an item's edits failed for a reason the user can't act on. */
export const ITEM_UPDATE_FAILED = "Couldn't save your changes. Please try again.";

export const ITEM_DELETE_FAILED = "Couldn't delete this item. Please try again.";

export const FOLDER_CREATE_FAILED = "Couldn't create this folder. Please try again.";

export const FOLDER_RENAME_FAILED = "Couldn't rename this folder. Please try again.";

export const FOLDER_MOVE_FAILED = "Couldn't move this folder. Please try again.";

export const FOLDER_DELETE_FAILED = "Couldn't delete this folder. Please try again.";

export const FILE_MOVE_FAILED = "Couldn't move this file. Please try again.";

export const ACCOUNT_DELETE_FAILED = "Couldn't delete your account. Please try again.";

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

/** A Free account tried an AI feature. Kept apart from `PRO_REQUIRED`, whose copy is about uploads. */
export const AI_PRO_REQUIRED = "AI features are part of DevStash Pro.";

/** No OpenAI key is configured, or OpenAI refused the key. */
export const AI_UNAVAILABLE = "AI features are unavailable right now.";

/** Suggesting tags failed for a reason the user can't act on, such as a timeout. */
export const AI_TAGS_FAILED = "Couldn't suggest tags. Please try again.";

/** Generating a description failed for a reason the user can't act on, such as a timeout. */
export const AI_DESCRIPTION_FAILED = "Couldn't write a description. Please try again.";

/** Explaining code failed for a reason a retry can fix. */
export const AI_EXPLAIN_FAILED = "Couldn't explain this code. Please try again.";

/** Optimizing a prompt failed for a reason a retry can fix. */
export const AI_OPTIMIZE_FAILED = "Couldn't optimize this prompt. Please try again.";

/** Saving an item's content (e.g. an optimized prompt) failed. */
export const CONTENT_SAVE_FAILED = "Couldn't save the prompt. Please try again.";

/** Starting Stripe Checkout failed for a reason the user can't act on. */
export const CHECKOUT_FAILED = "Couldn't start checkout. Please try again.";

/** Opening the Stripe Customer Portal failed for a reason the user can't act on. */
export const BILLING_PORTAL_FAILED = "Couldn't open billing. Please try again.";

/** Errors a Free account can fix by upgrading, so their toast offers an Upgrade action. */
const UPGRADE_ERRORS: ReadonlySet<string> = new Set([
  ITEM_LIMIT_REACHED,
  COLLECTION_LIMIT_REACHED,
  PRO_REQUIRED,
  AI_PRO_REQUIRED,
]);

export function isUpgradeError(error: string | null): boolean {
  return error !== null && UPGRADE_ERRORS.has(error);
}

/** An upload that would take the account past its storage allowance. */
export const STORAGE_QUOTA_REACHED = `This upload would go over your ${
  STORAGE_QUOTA_BYTES / 1024 ** 3
} GB of storage. Delete some files to make room.`;
