import { z } from "zod";

import { FILE_NOT_FOUND, FOLDER_NOT_FOUND } from "@/lib/action-result";
import { FOLDER_NAME_MAX_LENGTH } from "@/lib/folders";

/**
 * Folder ids are Prisma cuids, so anything else can't match a row and fails
 * like a missing folder, without a query.
 */
export const folderIdSchema = z.cuid({ error: FOLDER_NOT_FOUND });

/** Where a folder or file goes: a folder's id, or null for the top level. */
const destinationSchema = folderIdSchema.nullable();

export const folderNameSchema = z
  .string({ error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(FOLDER_NAME_MAX_LENGTH, `Names can be up to ${FOLDER_NAME_MAX_LENGTH} characters`);

/** New Folder: a name, inside the open folder (null at the top level). */
export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: destinationSchema,
});

export type CreateFolderInput = z.input<typeof createFolderSchema>;

export const renameFolderSchema = z.object({
  folderId: folderIdSchema,
  name: folderNameSchema,
});

export type RenameFolderInput = z.input<typeof renameFolderSchema>;

export const moveFolderSchema = z.object({
  folderId: folderIdSchema,
  parentId: destinationSchema,
});

export type MoveFolderInput = z.input<typeof moveFolderSchema>;

export const moveItemSchema = z.object({
  itemId: z.cuid({ error: FILE_NOT_FOUND }),
  folderId: destinationSchema,
});

export type MoveItemInput = z.input<typeof moveItemSchema>;
