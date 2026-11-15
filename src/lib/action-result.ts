import type { z } from "zod";

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
