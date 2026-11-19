"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { FILE_ROW_ACTIONS, FILE_ROW_COLUMNS, FileRow } from "@/components/items/FileRow";
import { FileRowDialogs, type RowDialog } from "@/components/items/FileRowDialogs";
import { FileSortControl } from "@/components/items/FileSortControl";
import { FileTypeIcon } from "@/components/items/FileTypeIcon";
import { FilterSelect } from "@/components/items/FilterSelect";
import { FolderBreadcrumb } from "@/components/items/FolderBreadcrumb";
import { FolderRow, type FolderAction } from "@/components/items/FolderRow";
import { Button } from "@/components/ui/button";
import { useFileListView } from "@/hooks/use-file-list-view";
import {
  DEFAULT_FILE_FILTERS,
  FILE_DATE_FILTERS,
  FILE_TYPE_FILTERS,
  getFilteredFilesHref,
  type FileFilters,
  type FileTypeFilter,
} from "@/lib/file-filters";
import {
  formatFolderPath,
  getFolderHref,
  getFolderPath,
  type FolderEntry,
  type FolderFileCounts,
} from "@/lib/folders";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileListItem } from "@/types/items";

interface FileListProps {
  /** The open folder's files, or with a filter on, the matches in every folder. */
  items: FileListItem[];
  /** Every file the user has, for "N of M files". */
  total: number;
  /** Files directly in each folder, for folder rows and the delete warning. */
  folderCounts: FolderFileCounts;
  /** Every folder. */
  folders: FolderEntry[];
  /** The open folder; null at the top level. */
  folderId: string | null;
  /** The Type and Uploaded filters, read from the URL. */
  filters: FileFilters;
}

/**
 * The /items/files list. With no filter on, it shows the open folder: a
 * breadcrumb, then its sub-folders, then its files. With a Type or Uploaded
 * filter on, folders hide and every matching file in every folder shows, each
 * with its folder path. Sort applies to folders and files separately, folders
 * first. The filters are part of the URL, so the server loads only what they
 * match; opening a folder (whose link carries none) clears them, and Clear
 * filters goes back to the folder that was open. The sort is browser state:
 * it needs no request, resets on reload and carries over between folders.
 */
export function FileList({
  items,
  total,
  folderCounts,
  folders,
  folderId,
  filters,
}: Readonly<FileListProps>) {
  const router = useRouter();
  const view = useFileListView(items, folders, folderCounts, folderId, filters);
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { filtering, shownFiles, shownFolders } = view;

  function updateFilters(next: Partial<FileFilters>) {
    router.push(getFilteredFilesHref(getFolderHref(folderId), { ...filters, ...next }), {
      scroll: false,
    });
  }
  const isEmpty = shownFiles.length === 0 && shownFolders.length === 0;

  function openDialog(next: RowDialog) {
    setDialog(next);
    setDialogOpen(true);
  }

  function handleFolderAction(folder: FolderEntry, action: FolderAction) {
    openDialog(
      action === "move"
        ? { kind: "move", subject: { kind: "folder", id: folder.id, name: folder.name, location: folder.parentId } }
        : { kind: action, folder },
    );
  }

  function folderPathOf(item: FileListItem) {
    return {
      label: formatFolderPath(getFolderPath(view.byId, item.folderId)),
      href: getFolderHref(item.folderId),
    };
  }

  return (
    <div className="flex flex-col gap-4">
      {filtering ? (
        <p className="text-sm text-muted-foreground">Showing matches from every folder.</p>
      ) : (
        <FolderBreadcrumb path={getFolderPath(view.byId, folderId)} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="File type"
          placeholder="Type"
          options={FILE_TYPE_FILTERS}
          value={filters.type}
          defaultValue={DEFAULT_FILE_FILTERS.type}
          onChange={(type) => updateFilters({ type })}
          renderIcon={renderFileTypeIcon}
        />
        <FilterSelect
          label="Upload date"
          placeholder="Uploaded"
          options={FILE_DATE_FILTERS}
          value={filters.date}
          defaultValue={DEFAULT_FILE_FILTERS.date}
          onChange={(date) => updateFilters({ date })}
        />
        <FileSortControl sort={view.sort} onChange={view.setSort} />
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => updateFilters(DEFAULT_FILE_FILTERS)}>
            Clear filters
          </Button>
        )}
        {/* Always in the DOM, filled only while filtering: a live region that
            mounts together with its text isn't announced. */}
        <p role="status" className="ml-auto text-sm text-muted-foreground empty:hidden">
          {filtering ? `${shownFiles.length} of ${formatCount(total, "file")}` : ""}
        </p>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          {filtering
            ? "No files match these filters."
            : folderId
              ? "This folder is empty."
              : "No files yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div
            aria-hidden
            className="hidden items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:flex"
          >
            <span className="size-5 shrink-0" />
            <div className={cn("min-w-0 flex-1", FILE_ROW_COLUMNS)}>
              <span>Name</span>
              <span>Size</span>
              <span>Uploaded</span>
            </div>
            <span className={FILE_ROW_ACTIONS} />
          </div>
          <ul className="divide-y divide-border">
            {shownFolders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                itemCount={view.itemCounts.get(folder.id) ?? 0}
                onAction={(action) => handleFolderAction(folder, action)}
              />
            ))}
            {shownFiles.map((item) => (
              <FileRow
                key={item.id}
                item={item}
                folderPath={filtering ? folderPathOf(item) : undefined}
                onMove={() =>
                  openDialog({
                    kind: "move",
                    subject: { kind: "file", id: item.id, name: item.title, location: item.folderId },
                  })
                }
              />
            ))}
          </ul>
        </div>
      )}

      <FileRowDialogs
        dialog={dialog}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folderCounts={folderCounts}
        folders={folders}
      />
    </div>
  );
}

/** The type filter's option icon; "All types" gets the plain file icon. */
function renderFileTypeIcon(type: FileTypeFilter) {
  return <FileTypeIcon category={type === "all" ? null : type} className="size-4" />;
}
