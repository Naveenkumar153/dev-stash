"use client";

import { useMemo, useState, type ReactNode } from "react";

import { renameFolder } from "@/actions/folders";
import { FILE_ROW_ACTIONS, FILE_ROW_COLUMNS, FileRow } from "@/components/items/FileRow";
import { FileSortControl } from "@/components/items/FileSortControl";
import { FileTypeIcon } from "@/components/items/FileTypeIcon";
import { FolderBreadcrumb } from "@/components/items/FolderBreadcrumb";
import { FolderDeleteDialog } from "@/components/items/FolderDeleteDialog";
import { FolderNameDialog } from "@/components/items/FolderNameDialog";
import { FolderRow, type FolderAction } from "@/components/items/FolderRow";
import { MoveToDialog, type MoveSubject } from "@/components/items/MoveToDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemSummary } from "@/lib/db/items";
import {
  DEFAULT_FILE_FILTERS,
  DEFAULT_FILE_SORT,
  FILE_DATE_FILTERS,
  FILE_TYPE_FILTERS,
  type FileFilters,
  type FileSort,
  type FileTypeFilter,
  isFileFilterActive,
  matchesFileFilters,
  sortFiles,
  sortFolders,
} from "@/lib/file-filters";
import {
  countDirectContents,
  countSubtree,
  formatFolderPath,
  getFolderHref,
  getFolderPath,
  groupByParent,
  type FolderEntry,
} from "@/lib/folders";
import { cn } from "@/lib/utils";

interface FilterState {
  filters: FileFilters;
  /** When the filters last changed; date ranges count back from here. */
  now: Date;
}

/** The dialog a row's menu opened. Kept after closing, so the dialog has content while it animates out. */
type RowDialog =
  | { kind: "rename" | "delete"; folder: FolderEntry }
  | { kind: "move"; subject: MoveSubject };

interface FileListProps {
  /** Every file, in every folder. */
  items: ItemSummary[];
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
  const [dialog, setDialog] = useState<RowDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
  const isEmpty = shownFiles.length === 0 && shownFolders.length === 0;

  function update(next: Partial<FileFilters>) {
    // The time is taken here, not during render, so rendering stays pure.
    setState({ filters: { ...filters, ...next }, now: new Date() });
  }

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

  function folderPathOf(item: ItemSummary) {
    return {
      label: formatFolderPath(getFolderPath(byId, item.folderId)),
      href: getFolderHref(item.folderId),
    };
  }

  const rowFolder = dialog?.kind === "rename" || dialog?.kind === "delete" ? dialog.folder : null;

  return (
    <div className="flex flex-col gap-4">
      {filtering ? (
        <p className="text-sm text-muted-foreground">Showing matches from every folder.</p>
      ) : (
        <FolderBreadcrumb path={getFolderPath(byId, folderId)} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="File type"
          placeholder="Type"
          options={FILE_TYPE_FILTERS}
          value={filters.type}
          defaultValue={DEFAULT_FILE_FILTERS.type}
          onChange={(type) => update({ type })}
          renderIcon={renderFileTypeIcon}
        />
        <FilterSelect
          label="Upload date"
          placeholder="Uploaded"
          options={FILE_DATE_FILTERS}
          value={filters.date}
          defaultValue={DEFAULT_FILE_FILTERS.date}
          onChange={(date) => update({ date })}
        />
        <FileSortControl sort={sort} onChange={setSort} />
        {filtering && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setState(null)}>
              Clear filters
            </Button>
            <p role="status" className="ml-auto text-sm text-muted-foreground">
              {shownFiles.length} of {items.length} files
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
                itemCount={itemCounts.get(folder.id) ?? 0}
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

      {/* Keyed by folder, so the name field always starts from the folder it was opened for. */}
      <FolderNameDialog
        key={rowFolder?.id}
        open={dialogOpen && dialog?.kind === "rename"}
        onOpenChange={setDialogOpen}
        title="Rename folder"
        description={`Renames “${rowFolder?.name ?? ""}”.`}
        submitLabel="Rename"
        pendingLabel="Renaming..."
        successMessage="Folder renamed"
        initialName={rowFolder?.name}
        onSubmit={(name) => renameFolder({ folderId: rowFolder?.id ?? "", name })}
      />
      <MoveToDialog
        open={dialogOpen && dialog?.kind === "move"}
        onOpenChange={setDialogOpen}
        subject={dialog?.kind === "move" ? dialog.subject : null}
        folders={folders}
      />
      <FolderDeleteDialog
        open={dialogOpen && dialog?.kind === "delete"}
        onOpenChange={setDialogOpen}
        folder={rowFolder}
        contents={rowFolder ? countSubtree(folders, items, rowFolder.id) : { folders: 0, files: 0 }}
      />
    </div>
  );
}

/** The type filter's option icon; "All types" gets the plain file icon. */
function renderFileTypeIcon(type: FileTypeFilter) {
  return <FileTypeIcon category={type === "all" ? null : type} className="size-4" />;
}

interface FilterSelectProps<T extends string> {
  /** Accessible name of the trigger. */
  label: string;
  /** Shown in the trigger while the filter is off, like Drive's chip names. */
  placeholder: string;
  options: readonly { value: T; label: string }[];
  value: T;
  defaultValue: T;
  onChange: (value: T) => void;
  /** An icon beside each option, and in the chip once a value is picked. */
  renderIcon?: (value: T) => ReactNode;
}

/** A filter chip: a compact select that reads its name until a value is picked. */
function FilterSelect<T extends string>({
  label,
  placeholder,
  options,
  value,
  defaultValue,
  onChange,
  renderIcon,
}: Readonly<FilterSelectProps<T>>) {
  const on = value !== defaultValue;

  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger
        aria-label={label}
        className={cn("rounded-full", on && "border-primary/50 bg-primary/10")}
      >
        <SelectValue>
          {(selected: T) =>
            selected === defaultValue ? (
              placeholder
            ) : (
              <>
                {renderIcon?.(selected)}
                {options.find((option) => option.value === selected)?.label}
              </>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {renderIcon?.(option.value)}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
