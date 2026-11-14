import { connection } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { getCurrentUserId } from "@/lib/db/user";
import { getSubtreeIds, type FolderEntry } from "@/lib/folders";
import { prisma } from "@/lib/prisma";
import type { FolderRef } from "@/types/folders";

const FOLDER_REF_SELECT = { id: true, name: true, parentId: true } as const;

/**
 * Every folder the files page can show, in no particular order - the page
 * sorts them. Scoped through `getCurrentUserId()` like the file list, so the
 * folders always match the files they hold.
 */
export async function getFolders(): Promise<FolderEntry[]> {
  // See getRecentCollections: keeps the list out of the build-time prerender.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  return prisma.folder.findMany({
    where: { userId },
    select: { ...FOLDER_REF_SELECT, createdAt: true },
  });
}

/** One of `userId`'s folders; null when there is no such folder or it's someone else's. */
export function findFolder(userId: string, folderId: string): Promise<FolderRef | null> {
  return prisma.folder.findFirst({ where: { id: folderId, userId }, select: FOLDER_REF_SELECT });
}

/** The folders directly inside `parentId` (null for the top level), for the sibling name check. */
export function getChildFolders(
  userId: string,
  parentId: string | null,
): Promise<{ id: string; name: string }[]> {
  return prisma.folder.findMany({ where: { userId, parentId }, select: { id: true, name: true } });
}

/**
 * Every one of `userId`'s folders with its name and place in the tree, so a
 * move can check for cycles and name clashes without another query.
 */
export function getFolderTree(userId: string): Promise<FolderRef[]> {
  return prisma.folder.findMany({ where: { userId }, select: FOLDER_REF_SELECT });
}

export function insertFolder(
  userId: string,
  name: string,
  parentId: string | null,
): Promise<FolderRef> {
  return prisma.folder.create({ data: { name, userId, parentId }, select: FOLDER_REF_SELECT });
}

/**
 * Renames or moves one of `userId`'s folders. The write is scoped to the
 * owner, so it can't land on anyone else's folder. Null when the folder is
 * gone, e.g. deleted since the caller looked it up.
 */
export async function updateFolder(
  userId: string,
  folderId: string,
  data: { name: string } | { parentId: string | null },
): Promise<FolderRef | null> {
  try {
    return await prisma.folder.update({
      where: { id: folderId, userId },
      data,
      select: FOLDER_REF_SELECT,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}

export interface DeletedFolderTree {
  /** Sub-folders deleted along with the folder. */
  folders: number;
  /** Files deleted from the folder and its sub-folders. */
  files: number;
  /** Where those files were stored in R2, for the caller to remove. */
  fileKeys: string[];
}

/**
 * Deletes one of `userId`'s folders with everything beneath it: its
 * sub-folders at any depth and the items in all of them. Null when there is no
 * such folder or it's someone else's.
 *
 * One transaction reads the tree, collects the files' R2 keys and deletes
 * exactly the items it read, then the folders. A file uploaded into the tree
 * meanwhile isn't in that list, so instead of being deleted without its key
 * it falls back to the top level through `Item.folder`'s SetNull.
 */
export function deleteFolderTree(
  userId: string,
  folderId: string,
): Promise<DeletedFolderTree | null> {
  return prisma.$transaction(async (tx) => {
    const links = await tx.folder.findMany({
      where: { userId },
      select: { id: true, parentId: true },
    });

    if (!links.some((folder) => folder.id === folderId)) {
      return null;
    }

    const folderIds = getSubtreeIds(links, folderId);
    const items = await tx.item.findMany({
      where: { userId, folderId: { in: folderIds } },
      select: { id: true, fileUrl: true },
    });

    await tx.item.deleteMany({ where: { userId, id: { in: items.map((item) => item.id) } } });
    await tx.folder.deleteMany({ where: { userId, id: { in: folderIds } } });

    return {
      folders: folderIds.length - 1,
      files: items.length,
      fileKeys: items.flatMap((item) => (item.fileUrl ? [item.fileUrl] : [])),
    };
  });
}

/**
 * Moves one of `userId`'s file items into `folderId` (null for the top level).
 * Only items of the system file type move - images are file-backed too, but
 * folders hold files only. False when no such item matched.
 */
export async function moveFileItem(
  userId: string,
  itemId: string,
  folderId: string | null,
): Promise<boolean> {
  const { count } = await prisma.item.updateMany({
    where: { id: itemId, userId, itemType: { name: "file", isSystem: true } },
    data: { folderId },
  });

  return count > 0;
}
