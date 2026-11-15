"use client";

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
  type FileTypeFilter,
} from "@/lib/file-filters";
import {
  formatFolderPath,
  getFolderHref,
  getFolderPath,
  type FolderEntry,
} from "@/lib/folders";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileListItem } from "@/types/items";

interface FileListProps {
  /** Every file, in every folder. */
  items: FileListItem[];
  /** Every folder. */
  folders: FolderEntry[];
  /** The open folder; null at the top level. */
  folderId: string | null;
}

/**
 * The /items/files list. With no filter on, it shows the open folder: a
 * breadcrumb, then its sub-folders, then its files. With a Type or Uploaded
 * filter on, folders hide and every matching file in every folder shows, each
 * with its folder path. Sort applies to folders and files separately, folders
 * first. Everything is derived from the folders and files the page already
 * loaded, so filtering and sorting need no request. Both reset on reload; the
 * sort carries over between folders, since moving between them keeps this
 * mounted, while the filters clear.
 */
export function FileList({ items, folders, folderId }: Readonly<FileListProps>) {
  const view = useFileListView(items, folders, folderId);
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { filters, filtering, shownFiles, shownFolders } = view;
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
          onChange={(type) => view.updateFilters({ type })}
          renderIcon={renderFileTypeIcon}
        />
        <FilterSelect
          label="Upload date"
          placeholder="Uploaded"
          options={FILE_DATE_FILTERS}
          value={filters.date}
          defaultValue={DEFAULT_FILE_FILTERS.date}
          onChange={(date) => view.updateFilters({ date })}
        />
        <FileSortControl sort={view.sort} onChange={view.setSort} />
        {filtering && (
          <>
            <Button variant="ghost" size="sm" onClick={view.clearFilters}>
              Clear filters
            </Button>
            <p role="status" className="ml-auto text-sm text-muted-foreground">
              {shownFiles.length} of {formatCount(items.length, "file")}
            </p>
          </>
        )}
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
        items={items}
        folders={folders}
      />
    </div>
  );
}

/** The type filter's option icon; "All types" gets the plain file icon. */
function renderFileTypeIcon(type: FileTypeFilter) {
  return <FileTypeIcon category={type === "all" ? null : type} className="size-4" />;
}
