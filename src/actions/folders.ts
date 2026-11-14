"use server";

import type { z } from "zod";

import { auth } from "@/auth";
import { getFieldErrors, type FieldErrors } from "@/lib/auth-schemas";
import {
  deleteFolderTree,
  findFolder,
  getChildFolders,
  getFolderTree,
  insertFolder,
  moveFileItem,
  updateFolder,
} from "@/lib/db/folders";
import {
  FILE_NOT_FOUND,
  FOLDER_NOT_FOUND,
  createFolderSchema,
  folderIdSchema,
  moveFolderSchema,
  moveItemSchema,
  renameFolderSchema,
  type CreateFolderInput,
  type MoveFolderInput,
  type MoveItemInput,
  type RenameFolderInput,
} from "@/lib/folder-schemas";
import { hasNameClash, wouldCreateCycle } from "@/lib/folders";
import { discardStoredFiles } from "@/lib/stored-files";
import type { DeleteFolderResult, FolderRef, FolderResult, MoveItemResult } from "@/types/folders";

const SESSION_EXPIRED = "Your session has expired. Sign in again.";
const DESTINATION_NOT_FOUND = "The folder you picked doesn't exist or has been deleted.";
const MOVE_INTO_ITSELF = "A folder can't be moved into itself or one of its sub-folders.";

/**
 * The session's user id. Every query below is scoped to it, so another user's
 * folder or file fails like a missing one.
 */
async function getSessionUserId(): Promise<string | null> {
  const session = await auth();

  return session?.user?.id ?? null;
}

function failure(error: string, fieldErrors: FieldErrors = {}): FolderResult {
  return { success: false, data: null, error, fieldErrors };
}

function invalid(error: z.ZodError): FolderResult {
  return failure(error.issues[0].message, getFieldErrors(error));
}

/** A sibling already has the name, shown on the dialog's name field. */
function nameTaken(name: string): FolderResult {
  const message = `A folder named “${name}” already exists there.`;

  return failure(message, { name: message });
}

function saved(folder: FolderRef): FolderResult {
  return { success: true, data: folder, error: null, fieldErrors: {} };
}

/** Creates a folder for the signed-in user inside `parentId`, or at the top level for null. */
export async function createFolder(input: CreateFolderInput): Promise<FolderResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error);
  }

  const { name, parentId } = parsed.data;

  try {
    const [parent, siblings] = await Promise.all([
      parentId ? findFolder(userId, parentId) : null,
      getChildFolders(userId, parentId),
    ]);

    if (parentId && !parent) {
      return failure(FOLDER_NOT_FOUND);
    }
    if (hasNameClash(siblings, name)) {
      return nameTaken(name);
    }

    return saved(await insertFolder(userId, name, parentId));
  } catch (error) {
    console.error("Creating folder failed", error);
    return failure("Couldn't create this folder. Please try again.");
  }
}

/** Renames one of the signed-in user's folders. Changing only the case of its name is allowed. */
export async function renameFolder(input: RenameFolderInput): Promise<FolderResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  const parsed = renameFolderSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error);
  }

  const { folderId, name } = parsed.data;

  try {
    const folder = await findFolder(userId, folderId);
    if (!folder) {
      return failure(FOLDER_NOT_FOUND);
    }
    if (hasNameClash(await getChildFolders(userId, folder.parentId), name, folderId)) {
      return nameTaken(name);
    }

    const renamed = await updateFolder(userId, folderId, { name });

    return renamed ? saved(renamed) : failure(FOLDER_NOT_FOUND);
  } catch (error) {
    console.error("Renaming folder failed", error);
    return failure("Couldn't rename this folder. Please try again.");
  }
}

/**
 * Moves one of the signed-in user's folders, with everything in it, into
 * `parentId` (null for the top level). Refused when the destination is the
 * folder itself or one of its sub-folders, or already holds a folder of the
 * same name. Moving a folder to where it already is succeeds without a write.
 */
export async function moveFolder(input: MoveFolderInput): Promise<FolderResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  const parsed = moveFolderSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(parsed.error);
  }

  const { folderId, parentId } = parsed.data;

  try {
    const tree = await getFolderTree(userId);
    const folder = tree.find((entry) => entry.id === folderId);

    if (!folder) {
      return failure(FOLDER_NOT_FOUND);
    }
    if (parentId && !tree.some((entry) => entry.id === parentId)) {
      return failure(DESTINATION_NOT_FOUND);
    }
    if (wouldCreateCycle(tree, folderId, parentId)) {
      return failure(MOVE_INTO_ITSELF);
    }
    if (folder.parentId === parentId) {
      return saved(folder);
    }

    const siblings = tree.filter((entry) => entry.parentId === parentId);
    if (hasNameClash(siblings, folder.name, folderId)) {
      return nameTaken(folder.name);
    }

    const moved = await updateFolder(userId, folderId, { parentId });

    return moved ? saved(moved) : failure(FOLDER_NOT_FOUND);
  } catch (error) {
    console.error("Moving folder failed", error);
    return failure("Couldn't move this folder. Please try again.");
  }
}

function deleteFailure(error: string): DeleteFolderResult {
  return { success: false, data: null, error };
}

/**
 * Permanently deletes one of the signed-in user's folders with its sub-folders
 * and every file in them. The rows go in one transaction first, then the
 * files' R2 objects, so a failure can never leave an item pointing at a
 * missing file.
 */
export async function deleteFolder(folderId: string): Promise<DeleteFolderResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return deleteFailure(SESSION_EXPIRED);
  }

  if (!folderIdSchema.safeParse(folderId).success) {
    return deleteFailure(FOLDER_NOT_FOUND);
  }

  let deleted;
  try {
    deleted = await deleteFolderTree(userId, folderId);
  } catch (error) {
    console.error("Deleting folder failed", error);
    return deleteFailure("Couldn't delete this folder. Please try again.");
  }

  if (!deleted) {
    return deleteFailure(FOLDER_NOT_FOUND);
  }

  // The rows are already gone, so a failure here only leaves unreachable files.
  await discardStoredFiles(deleted.fileKeys);

  return {
    success: true,
    data: { id: folderId, folders: deleted.folders, files: deleted.files },
    error: null,
  };
}

function moveItemFailure(error: string): MoveItemResult {
  return { success: false, data: null, error };
}

/** Moves one of the signed-in user's files into `folderId`, or to the top level for null. */
export async function moveItem(input: MoveItemInput): Promise<MoveItemResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return moveItemFailure(SESSION_EXPIRED);
  }

  const parsed = moveItemSchema.safeParse(input);
  if (!parsed.success) {
    return moveItemFailure(parsed.error.issues[0].message);
  }

  const { itemId, folderId } = parsed.data;

  try {
    if (folderId && !(await findFolder(userId, folderId))) {
      return moveItemFailure(DESTINATION_NOT_FOUND);
    }
    if (!(await moveFileItem(userId, itemId, folderId))) {
      return moveItemFailure(FILE_NOT_FOUND);
    }

    return { success: true, data: { id: itemId, folderId }, error: null };
  } catch (error) {
    console.error("Moving file failed", error);
    return moveItemFailure("Couldn't move this file. Please try again.");
  }
}
