"use server";

import { refresh } from "next/cache";

import {
  FILE_MOVE_FAILED,
  FILE_NOT_FOUND,
  FOLDER_CREATE_FAILED,
  FOLDER_DELETE_FAILED,
  FOLDER_MOVE_FAILED,
  FOLDER_NOT_FOUND,
  FOLDER_RENAME_FAILED,
  PRO_REQUIRED,
  SESSION_EXPIRED,
  actionFailure,
  formFailure,
  validationFailure,
} from "@/lib/action-result";
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
import { getSessionUserId } from "@/lib/session";
import { discardStoredFiles } from "@/lib/stored-files";
import { getSessionEntitlements } from "@/lib/usage-limits";
import type { DeleteFolderResult, FolderRef, FolderResult, MoveItemResult } from "@/types/folders";

const DESTINATION_NOT_FOUND = "The folder you picked doesn't exist or has been deleted.";
const MOVE_INTO_ITSELF = "A folder can't be moved into itself or one of its sub-folders.";

/** A sibling already has the name, shown on the dialog's name field. */
function nameTaken(name: string): FolderResult {
  const message = `A folder named “${name}” already exists there.`;

  return formFailure(message, { name: message });
}

/** A folder write succeeded: the page behind the dialog re-renders in this response. */
function saved(folder: FolderRef): FolderResult {
  refresh();
  return { success: true, data: folder, error: null, fieldErrors: {} };
}

/**
 * Creates a folder for the signed-in user inside `parentId`, or at the top
 * level for null. Folders hold files, a Pro feature, so creating one needs Pro
 * access; renaming, moving and deleting don't, so a downgraded account can
 * still tidy up what it has.
 */
export async function createFolder(input: CreateFolderInput): Promise<FolderResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return formFailure(SESSION_EXPIRED);
  }
  if (!entitlements.hasProAccess) {
    return formFailure(PRO_REQUIRED);
  }
  const { userId } = entitlements;

  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { name, parentId } = parsed.data;

  try {
    const [parent, siblings] = await Promise.all([
      parentId ? findFolder(userId, parentId) : null,
      getChildFolders(userId, parentId),
    ]);

    if (parentId && !parent) {
      return formFailure(FOLDER_NOT_FOUND);
    }
    if (hasNameClash(siblings, name)) {
      return nameTaken(name);
    }

    return saved(await insertFolder(userId, name, parentId));
  } catch (error) {
    console.error("Creating folder failed", error);
    return formFailure(FOLDER_CREATE_FAILED);
  }
}

/** Renames one of the signed-in user's folders. Changing only the case of its name is allowed. */
export async function renameFolder(input: RenameFolderInput): Promise<FolderResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return formFailure(SESSION_EXPIRED);
  }

  const parsed = renameFolderSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { folderId, name } = parsed.data;

  try {
    const folder = await findFolder(userId, folderId);
    if (!folder) {
      return formFailure(FOLDER_NOT_FOUND);
    }
    if (hasNameClash(await getChildFolders(userId, folder.parentId), name, folderId)) {
      return nameTaken(name);
    }

    const renamed = await updateFolder(userId, folderId, { name });

    return renamed ? saved(renamed) : formFailure(FOLDER_NOT_FOUND);
  } catch (error) {
    console.error("Renaming folder failed", error);
    return formFailure(FOLDER_RENAME_FAILED);
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
    return formFailure(SESSION_EXPIRED);
  }

  const parsed = moveFolderSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }

  const { folderId, parentId } = parsed.data;

  try {
    const tree = await getFolderTree(userId);
    const folder = tree.find((entry) => entry.id === folderId);

    if (!folder) {
      return formFailure(FOLDER_NOT_FOUND);
    }
    if (parentId && !tree.some((entry) => entry.id === parentId)) {
      return formFailure(DESTINATION_NOT_FOUND);
    }
    if (wouldCreateCycle(tree, folderId, parentId)) {
      return formFailure(MOVE_INTO_ITSELF);
    }
    if (folder.parentId === parentId) {
      return saved(folder);
    }

    const siblings = tree.filter((entry) => entry.parentId === parentId);
    if (hasNameClash(siblings, folder.name, folderId)) {
      return nameTaken(folder.name);
    }

    const moved = await updateFolder(userId, folderId, { parentId });

    return moved ? saved(moved) : formFailure(FOLDER_NOT_FOUND);
  } catch (error) {
    console.error("Moving folder failed", error);
    return formFailure(FOLDER_MOVE_FAILED);
  }
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
    return actionFailure(SESSION_EXPIRED);
  }

  if (!folderIdSchema.safeParse(folderId).success) {
    return actionFailure(FOLDER_NOT_FOUND);
  }

  let deleted;
  try {
    deleted = await deleteFolderTree(userId, folderId);
  } catch (error) {
    console.error("Deleting folder failed", error);
    return actionFailure(FOLDER_DELETE_FAILED);
  }

  if (!deleted) {
    return actionFailure(FOLDER_NOT_FOUND);
  }

  // The rows are already gone, so a failure here only leaves unreachable files.
  await discardStoredFiles(deleted.fileKeys);

  refresh();
  return {
    success: true,
    data: { id: folderId, folders: deleted.folders, files: deleted.files },
    error: null,
  };
}

/** Moves one of the signed-in user's files into `folderId`, or to the top level for null. */
export async function moveItem(input: MoveItemInput): Promise<MoveItemResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  const parsed = moveItemSchema.safeParse(input);
  if (!parsed.success) {
    return actionFailure(parsed.error.issues[0].message);
  }

  const { itemId, folderId } = parsed.data;

  try {
    if (folderId && !(await findFolder(userId, folderId))) {
      return actionFailure(DESTINATION_NOT_FOUND);
    }
    if (!(await moveFileItem(userId, itemId, folderId))) {
      return actionFailure(FILE_NOT_FOUND);
    }

    refresh();
    return { success: true, data: { id: itemId, folderId }, error: null };
  } catch (error) {
    console.error("Moving file failed", error);
    return actionFailure(FILE_MOVE_FAILED);
  }
}
