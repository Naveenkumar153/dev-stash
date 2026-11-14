import { getFileExtension } from "@/lib/file-upload";

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
