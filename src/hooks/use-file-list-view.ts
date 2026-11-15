"use client";

import { useMemo, useState } from "react";

import {
  DEFAULT_FILE_FILTERS,
  DEFAULT_FILE_SORT,
  isFileFilterActive,
  matchesFileFilters,
  sortFiles,
  sortFolders,
  type FileFilters,
  type FileSort,
} from "@/lib/file-filters";
import { countDirectContents, groupByParent, type FolderEntry } from "@/lib/folders";
import type { FileListItem } from "@/types/items";

interface FilterState {
  filters: FileFilters;
  /** When the filters last changed; date ranges count back from here. */
  now: Date;
}

/**
 * What the files list shows for the open folder: its sub-folders and files,
 * or, with a Type or Uploaded filter on, every matching file in every folder.
 * Holds the filter and sort state. Opening another folder clears the filters,
 * while the sort carries over.
 */
export function useFileListView(
  items: readonly FileListItem[],
  folders: readonly FolderEntry[],
  folderId: string | null,
) {
  const [state, setState] = useState<FilterState | null>(null);
  const [sort, setSort] = useState<FileSort>(DEFAULT_FILE_SORT);
  const [shownFolderId, setShownFolderId] = useState(folderId);

  // Opening a folder - from a filtered row's path, or back / forward - clears
  // the filters, or the list would stay flat and never show the folder. Reset
  // while rendering rather than in an effect, so the stale list never paints.
  if (folderId !== shownFolderId) {
    setShownFolderId(folderId);
    setState(null);
  }

  const byId = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const children = useMemo(() => groupByParent(folders), [folders]);
  const itemCounts = useMemo(() => countDirectContents(folders, items), [folders, items]);

  const filters = state?.filters ?? DEFAULT_FILE_FILTERS;
  const filtering = state !== null && isFileFilterActive(filters);
  const shownFiles = sortFiles(
    filtering
      ? items.filter((item) => matchesFileFilters(item, filters, state.now))
      : items.filter((item) => item.folderId === folderId),
    sort,
  );
  const shownFolders = filtering ? [] : sortFolders(children.get(folderId) ?? [], sort);

  function updateFilters(next: Partial<FileFilters>) {
    // The time is taken here, not during render, so rendering stays pure.
    setState({ filters: { ...filters, ...next }, now: new Date() });
  }

  return {
    byId,
    itemCounts,
    filters,
    filtering,
    sort,
    setSort,
    shownFiles,
    shownFolders,
    updateFilters,
    clearFilters: () => setState(null),
  };
}
