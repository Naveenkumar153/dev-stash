/**
 * Collection limits shared by the New Collection form and its schema. Kept out
 * of `collection-schemas.ts` so the form can read them without pulling Zod into
 * the client bundle.
 */

export const COLLECTION_NAME_MAX_LENGTH = 100;

export const COLLECTION_DESCRIPTION_MAX_LENGTH = 500;
