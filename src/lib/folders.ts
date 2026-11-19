import { getCreatableTypeFromPath, getItemTypeHref } from "@/lib/item-types";

/** A folder's place in the tree: enough to walk it up or down. */
export interface FolderLink {
  id: string;
  /** Null at the top level of /items/files. */
  parentId: string | null;
}

/** A folder as the files page lists it. */
export interface FolderEntry extends FolderLink {
  name: string;
  createdAt: Date;
}

/** Longest folder name allowed, in characters. */
export const FOLDER_NAME_MAX_LENGTH = 100;

/** The top level's name in breadcrumbs, paths and the Move to... picker. */
export const ROOT_FOLDER_LABEL = "Files";

/** The files page, opened at `folderId`, or at the top level for null. */
export function getFolderHref(folderId: string | null): string {
  const base = getItemTypeHref("file");

  return folderId ? `${base}?folder=${encodeURIComponent(folderId)}` : base;
}

/**
 * The folder open at a location: the files page's `?folder=`, or null at its
 * top level and on every other page. An id that isn't the user's is refused
 * by whatever it is sent to, like any other folder id.
 */
export function getOpenFolderId(
  pathname: string,
  searchParams: { get(name: string): string | null },
): string | null {
  if (getCreatableTypeFromPath(pathname) !== "file") {
    return null;
  }

  return searchParams.get("folder") || null;
}

/** Whether two folder names count as the same: case is ignored, as is Unicode composition. */
export function isSameFolderName(a: string, b: string): boolean {
  return a.normalize().toLowerCase() === b.normalize().toLowerCase();
}

/**
 * Whether `name` is taken among `siblings`, the folders already in the target
 * folder. `exceptId` leaves out the folder being renamed or moved, so
 * "docs" -> "Docs" is allowed.
 */
export function hasNameClash(
  siblings: readonly { id: string; name: string }[],
  name: string,
  exceptId?: string,
): boolean {
  return siblings.some((sibling) => sibling.id !== exceptId && isSameFolderName(sibling.name, name));
}

/** Each folder's direct sub-folders, keyed by parent id (null for the top level). */
export function groupByParent<T extends FolderLink>(folders: readonly T[]): Map<string | null, T[]> {
  const children = new Map<string | null, T[]>();

  for (const folder of folders) {
    const siblings = children.get(folder.parentId);
    if (siblings) {
      siblings.push(folder);
    } else {
      children.set(folder.parentId, [folder]);
    }
  }

  return children;
}

/**
 * The folders from the top level down to `folderId`, inclusive; empty for the
 * top level. Stops at a parent that isn't in `byId`, and at a folder already
 * visited, so a corrupt tree can't loop forever.
 */
export function getFolderPath<T extends FolderLink>(
  byId: ReadonlyMap<string, T>,
  folderId: string | null,
): T[] {
  const path: T[] = [];
  const seen = new Set<string>();
  let current = folderId === null ? undefined : byId.get(folderId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return path;
}

/** A folder path as one line: "Files / Docs / 2026", or "Files" for the top level. */
export function formatFolderPath(path: readonly { name: string }[]): string {
  return [ROOT_FOLDER_LABEL, ...path.map((folder) => folder.name)].join(" / ");
}

/** `rootId` and the ids of every folder beneath it, at any depth, root first. */
export function getSubtreeIds(folders: readonly FolderLink[], rootId: string): string[] {
  const children = groupByParent(folders);
  const ids = [rootId];
  const seen = new Set(ids);

  // ids grows while it's walked, so this visits each level in turn.
  for (let index = 0; index < ids.length; index++) {
    for (const child of children.get(ids[index]) ?? []) {
      if (!seen.has(child.id)) {
        seen.add(child.id);
        ids.push(child.id);
      }
    }
  }

  return ids;
}

/**
 * Whether moving `folderId` into `targetParentId` would put it inside itself:
 * the target is the folder or one of its descendants. Walks up from the target,
 * so it costs the target's depth rather than the folder's whole subtree.
 */
export function wouldCreateCycle(
  folders: readonly FolderLink[],
  folderId: string,
  targetParentId: string | null,
): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  return getFolderPath(byId, targetParentId).some((folder) => folder.id === folderId);
}

/**
 * How many files sit directly in each folder, keyed by folder id; folders
 * with none are left out. Counted by the server, since the page loads only
 * the open folder's files.
 */
export type FolderFileCounts = Readonly<Record<string, number>>;

/** How many sub-folders and files sit directly in each folder, keyed by folder id. */
export function countDirectContents(
  folders: readonly FolderLink[],
  fileCounts: FolderFileCounts,
): Map<string, number> {
  const counts = new Map<string, number>(Object.entries(fileCounts));

  for (const { parentId: id } of folders) {
    if (id !== null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

/** What deleting `rootId` takes with it: the folders beneath it and the files in any of them. */
export function countSubtree(
  folders: readonly FolderLink[],
  fileCounts: FolderFileCounts,
  rootId: string,
): { folders: number; files: number } {
  const ids = getSubtreeIds(folders, rootId);

  return {
    folders: ids.length - 1,
    files: ids.reduce((sum, id) => sum + (fileCounts[id] ?? 0), 0),
  };
}
