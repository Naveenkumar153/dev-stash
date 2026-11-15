import { getFileExtension } from "@/lib/file-upload";
import {
  describeSortOrder,
  getNaturalSort,
  nameCollator,
  type Sort,
  type SortDirection,
  type SortFieldOption,
} from "@/lib/sort";

/** The /items/files type filter: "all", or a category of file extensions. */
export const FILE_TYPE_FILTERS = [
  { value: "all", label: "All types", extensions: [] },
  { value: "pdf", label: "PDFs", extensions: ["pdf"] },
  { value: "document", label: "Documents", extensions: ["txt", "md"] },
  { value: "spreadsheet", label: "Spreadsheets", extensions: ["csv"] },
  { value: "data", label: "Data", extensions: ["json", "xml"] },
  { value: "config", label: "Config", extensions: ["yaml", "yml", "toml", "ini"] },
] as const satisfies readonly { value: string; label: string; extensions: readonly string[] }[];

export type FileTypeFilter = (typeof FILE_TYPE_FILTERS)[number]["value"];

/** A type filter other than "all": the category a file's extension falls in. */
export type FileCategory = Exclude<FileTypeFilter, "all">;

/** The category of a file name's extension, or null when it has none of them. */
export function getFileCategory(fileName: string | null): FileCategory | null {
  const extension = fileName ? getFileExtension(fileName) : "";
  const match = FILE_TYPE_FILTERS.find((filter) =>
    (filter.extensions as readonly string[]).includes(extension),
  );

  // "all" lists no extensions, so a match is always a category.
  return match ? (match.value as FileCategory) : null;
}

/** The /items/files date filter. Ranges count whole days, today included. */
export const FILE_DATE_FILTERS = [
  { value: "any", label: "Any time", days: null },
  { value: "today", label: "Today", days: 1 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
] as const satisfies readonly { value: string; label: string; days: number | null }[];

export type FileDateFilter = (typeof FILE_DATE_FILTERS)[number]["value"];

export interface FileFilters {
  type: FileTypeFilter;
  date: FileDateFilter;
}

export const DEFAULT_FILE_FILTERS: FileFilters = { type: "all", date: "any" };

export function isFileFilterActive({ type, date }: FileFilters): boolean {
  return type !== DEFAULT_FILE_FILTERS.type || date !== DEFAULT_FILE_FILTERS.date;
}

/**
 * The earliest upload time a date filter keeps, or null for "any". Days start
 * at UTC midnight because the list shows dates in UTC (`formatShortDate()`),
 * so a file dated "Nov 14" is always "Today" on Nov 14.
 */
export function getDateFilterStart(date: FileDateFilter, now: Date): Date | null {
  const { days } = FILE_DATE_FILTERS.find((filter) => filter.value === date)!;

  if (days === null) {
    return null;
  }

  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );
}

/** Whether a file passes both filters. A missing file name passes only "all". */
export function matchesFileFilters(
  file: { fileName: string | null; createdAt: Date },
  { type, date }: FileFilters,
  now: Date,
): boolean {
  if (type !== "all" && getFileCategory(file.fileName) !== type) {
    return false;
  }

  const start = getDateFilterStart(date, now);

  return start === null || file.createdAt >= start;
}

/**
 * The /items/files sort fields. Picking one switches to its natural direction
 * (A to Z for names, largest first for sizes, newest first for dates), and
 * each direction has a plain-language name for the order toggle.
 */
export const FILE_SORT_FIELDS = [
  { value: "uploaded", label: "Uploaded", defaultDirection: "desc", asc: "Oldest first", desc: "Newest first" },
  { value: "name", label: "Name", defaultDirection: "asc", asc: "A to Z", desc: "Z to A" },
  { value: "size", label: "Size", defaultDirection: "desc", asc: "Smallest first", desc: "Largest first" },
] as const satisfies readonly SortFieldOption<string>[];

export type FileSortField = (typeof FILE_SORT_FIELDS)[number]["value"];

export type FileSort = Sort<FileSortField>;

/** Newest first, the order the list had before it could be sorted. */
export const DEFAULT_FILE_SORT: FileSort = { field: "uploaded", direction: "desc" };

/** A sort field at its natural direction. */
export function getDefaultSort(field: FileSortField): FileSort {
  return getNaturalSort(FILE_SORT_FIELDS, field);
}

/** The order a sort puts the list in, in words: "Newest first", "A to Z". */
export function getSortOrderLabel(sort: FileSort): string {
  return describeSortOrder(FILE_SORT_FIELDS, sort);
}

type Comparison = (a: SortableEntry, b: SortableEntry) => number;

interface SortableEntry {
  id: string;
  createdAt: Date;
}

/** Oldest first; createdAt ties break on id, so the order is stable. */
const byCreated: Comparison = (a, b) =>
  a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function sortBy<T extends SortableEntry>(
  entries: readonly T[],
  compare: (a: T, b: T) => number,
  direction: SortDirection,
): T[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...entries].sort((a, b) => sign * (compare(a, b) || byCreated(a, b)));
}

/**
 * Files in a sort's order: by title for Name, by size for Size, by upload time
 * for Uploaded. Files without a size go last in either direction. Ties break on
 * upload time then id, in the same direction, so flipping it reverses the list.
 */
export function sortFiles<T extends SortableEntry & { title: string; fileSize: number | null }>(
  files: readonly T[],
  { field, direction }: FileSort,
): T[] {
  if (field === "name") {
    return sortBy(files, (a, b) => nameCollator.compare(a.title, b.title), direction);
  }
  if (field === "uploaded") {
    return sortBy(files, () => 0, direction);
  }

  const sized = files.filter((file) => file.fileSize !== null);
  const unsized = files.filter((file) => file.fileSize === null);

  return [
    ...sortBy(sized, (a, b) => a.fileSize! - b.fileSize!, direction),
    ...sortBy(unsized, () => 0, direction),
  ];
}

/**
 * Folders in a sort's order. Folders have no size, so Name and Size both sort
 * them by name - A to Z under Size, whichever way the files go - and Uploaded
 * sorts them by when they were created.
 */
export function sortFolders<T extends SortableEntry & { name: string }>(
  folders: readonly T[],
  { field, direction }: FileSort,
): T[] {
  const byName = (a: T, b: T) => nameCollator.compare(a.name, b.name);

  if (field === "uploaded") {
    return sortBy(folders, () => 0, direction);
  }

  return sortBy(folders, byName, field === "size" ? "asc" : direction);
}
