"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_FILE_SORT,
  isFileFilterActive,
  sortFiles,
  sortFolders,
  type FileFilters,
  type FileSort,
} from "@/lib/file-filters";
import {
  countDirectContents,
  groupByParent,
  type FolderEntry,
  type FolderFileCounts,
} from "@/lib/folders";
import type { FileListItem } from "@/types/items";

/**
 * What the files list shows: the server loaded either the open folder's files
 * or, with a Type or Uploaded filter on, the matching files in every folder;
 * this adds the open folder's sub-folders (none while filtering) and sorts
 * both. The sort is browser state that carries over between folders, since
 * moving between them keeps the list mounted; the filters live in the URL.
 */
export function useFileListView(
  items: readonly FileListItem[],
  folders: readonly FolderEntry[],
  folderCounts: FolderFileCounts,
  folderId: string | null,
  filters: FileFilters,
) {
  const [sort, setSort] = useState<FileSort>(DEFAULT_FILE_SORT);

  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const children = useMemo(() => groupByParent(folders), [folders]);
  const itemCounts = useMemo(
    () => countDirectContents(folders, folderCounts),
    [folders, folderCounts],
  );

  const filtering = isFileFilterActive(filters);
  const shownFiles = sortFiles(items, sort);
  const shownFolders = filtering ? [] : sortFolders(children.get(folderId) ?? [], sort);

  return { byId, itemCounts, filtering, sort, setSort, shownFiles, shownFolders };
}
