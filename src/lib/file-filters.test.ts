import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILE_FILTERS,
  DEFAULT_FILE_SORT,
  FILE_TYPE_FILTERS,
  getDateFilterStart,
  getDefaultSort,
  getFileCategory,
  getSortOrderLabel,
  isFileFilterActive,
  matchesFileFilters,
  sortFiles,
  sortFolders,
  type FileFilters,
} from "@/lib/file-filters";
import { UPLOAD_CONSTRAINTS } from "@/lib/file-upload";

const NOW = new Date("2026-11-14T15:30:00.000Z");

function file(fileName: string | null, createdAt = NOW) {
  return { fileName, createdAt };
}

function filters(overrides: Partial<FileFilters>): FileFilters {
  return { ...DEFAULT_FILE_FILTERS, ...overrides };
}

describe("FILE_TYPE_FILTERS", () => {
  it("puts every accepted file extension in exactly one category", () => {
    const categorized = FILE_TYPE_FILTERS.flatMap((filter) => [...filter.extensions]);

    expect(categorized.toSorted()).toEqual([...UPLOAD_CONSTRAINTS.file.extensions.keys()].toSorted());
  });
});

describe("getFileCategory", () => {
  it.each([
    ["Report.PDF", "pdf"],
    ["notes.md", "document"],
    ["readme.txt", "document"],
    ["data.csv", "spreadsheet"],
    ["package.json", "data"],
    ["feed.xml", "data"],
    ["docker-compose.yml", "config"],
    ["Cargo.toml", "config"],
  ] as const)("puts %s in %s", (fileName, category) => {
    expect(getFileCategory(fileName)).toBe(category);
  });

  it("returns null for a missing name, no extension or an unknown extension", () => {
    expect(getFileCategory(null)).toBeNull();
    expect(getFileCategory("Makefile")).toBeNull();
    expect(getFileCategory("photo.png")).toBeNull();
  });
});

describe("isFileFilterActive", () => {
  it("is off for the defaults and on when either filter changes", () => {
    expect(isFileFilterActive(DEFAULT_FILE_FILTERS)).toBe(false);
    expect(isFileFilterActive(filters({ type: "pdf" }))).toBe(true);
    expect(isFileFilterActive(filters({ date: "today" }))).toBe(true);
  });
});

describe("getDateFilterStart", () => {
  it("returns null for any time", () => {
    expect(getDateFilterStart("any", NOW)).toBeNull();
  });

  it.each([
    ["today", "2026-11-14T00:00:00.000Z"],
    ["7d", "2026-11-08T00:00:00.000Z"],
    ["30d", "2026-10-16T00:00:00.000Z"],
  ] as const)("starts %s at UTC midnight, today included", (date, expected) => {
    expect(getDateFilterStart(date, NOW)?.toISOString()).toBe(expected);
  });

  it("counts back across a year boundary", () => {
    expect(getDateFilterStart("7d", new Date("2027-01-03T08:00:00.000Z"))?.toISOString()).toBe(
      "2026-12-28T00:00:00.000Z",
    );
  });
});

describe("matchesFileFilters", () => {
  it("keeps everything with the default filters, including a missing file name", () => {
    expect(matchesFileFilters(file("a.pdf", new Date(0)), DEFAULT_FILE_FILTERS, NOW)).toBe(true);
    expect(matchesFileFilters(file(null), DEFAULT_FILE_FILTERS, NOW)).toBe(true);
  });

  it.each([
    ["pdf", "Report.PDF"],
    ["document", "notes.md"],
    ["document", "readme.txt"],
    ["spreadsheet", "data.csv"],
    ["data", "package.json"],
    ["data", "feed.xml"],
    ["config", "docker-compose.yml"],
    ["config", "settings.ini"],
  ] as const)("type %s keeps %s", (type, fileName) => {
    expect(matchesFileFilters(file(fileName), filters({ type }), NOW)).toBe(true);
  });

  it("drops other categories, names without an extension and missing names", () => {
    const pdfOnly = filters({ type: "pdf" });

    expect(matchesFileFilters(file("notes.md"), pdfOnly, NOW)).toBe(false);
    expect(matchesFileFilters(file("pdf"), pdfOnly, NOW)).toBe(false);
    expect(matchesFileFilters(file(null), pdfOnly, NOW)).toBe(false);
  });

  it("keeps a file uploaded exactly at the range start and drops one a millisecond earlier", () => {
    const today = filters({ date: "today" });

    expect(matchesFileFilters(file("a.pdf", new Date("2026-11-14T00:00:00.000Z")), today, NOW)).toBe(true);
    expect(matchesFileFilters(file("a.pdf", new Date("2026-11-13T23:59:59.999Z")), today, NOW)).toBe(false);
  });

  it("needs both filters to match", () => {
    const recentPdfs = filters({ type: "pdf", date: "7d" });
    const tenDaysAgo = new Date("2026-11-04T12:00:00.000Z");

    expect(matchesFileFilters(file("a.pdf", new Date("2026-11-10T12:00:00.000Z")), recentPdfs, NOW)).toBe(true);
    expect(matchesFileFilters(file("a.pdf", tenDaysAgo), recentPdfs, NOW)).toBe(false);
    expect(matchesFileFilters(file("a.csv", NOW), recentPdfs, NOW)).toBe(false);
  });
});

describe("file sort labels", () => {
  it("defaults to newest first", () => {
    expect(DEFAULT_FILE_SORT).toEqual({ field: "uploaded", direction: "desc" });
    expect(getSortOrderLabel(DEFAULT_FILE_SORT)).toBe("Newest first");
  });

  it("switches each field to its natural direction", () => {
    expect(getDefaultSort("name")).toEqual({ field: "name", direction: "asc" });
    expect(getDefaultSort("size")).toEqual({ field: "size", direction: "desc" });
    expect(getDefaultSort("uploaded")).toEqual({ field: "uploaded", direction: "desc" });
  });

  it("names each order in words", () => {
    expect(getSortOrderLabel({ field: "name", direction: "desc" })).toBe("Z to A");
    expect(getSortOrderLabel({ field: "size", direction: "asc" })).toBe("Smallest first");
    expect(getSortOrderLabel({ field: "uploaded", direction: "asc" })).toBe("Oldest first");
  });
});

function sortable(id: string, title: string, fileSize: number | null, day: number) {
  return { id, title, fileSize, createdAt: new Date(Date.UTC(2026, 10, day)) };
}

const ids = (entries: readonly { id: string }[]) => entries.map((entry) => entry.id);

describe("sortFiles", () => {
  const files = [
    sortable("a", "File 10", 300, 3),
    sortable("b", "file 2", null, 1),
    sortable("c", "Énoncé", 100, 4),
    sortable("d", "Budget", 300, 2),
  ];

  it("sorts by name numerically, ignoring case and accents", () => {
    expect(ids(sortFiles(files, { field: "name", direction: "asc" }))).toEqual(["d", "c", "b", "a"]);
    expect(ids(sortFiles(files, { field: "name", direction: "desc" }))).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts by upload time", () => {
    expect(ids(sortFiles(files, { field: "uploaded", direction: "desc" }))).toEqual(["c", "a", "d", "b"]);
    expect(ids(sortFiles(files, { field: "uploaded", direction: "asc" }))).toEqual(["b", "d", "a", "c"]);
  });

  it("sorts by size with files without a size last either way, ties by upload time", () => {
    expect(ids(sortFiles(files, { field: "size", direction: "desc" }))).toEqual(["a", "d", "c", "b"]);
    expect(ids(sortFiles(files, { field: "size", direction: "asc" }))).toEqual(["c", "d", "a", "b"]);
  });

  it("orders files without a size among themselves by upload time", () => {
    const unsized = [sortable("p", "One", null, 1), sortable("q", "Two", null, 9), sortable("r", "Three", 50, 5)];

    expect(ids(sortFiles(unsized, { field: "size", direction: "desc" }))).toEqual(["r", "q", "p"]);
    expect(ids(sortFiles(unsized, { field: "size", direction: "asc" }))).toEqual(["r", "p", "q"]);
  });

  it("breaks a tie on the same upload time by id, so flipping the direction reverses the list", () => {
    const twins = [sortable("y", "Same", 1, 5), sortable("x", "Same", 1, 5)];

    expect(ids(sortFiles(twins, { field: "name", direction: "asc" }))).toEqual(["x", "y"]);
    expect(ids(sortFiles(twins, { field: "name", direction: "desc" }))).toEqual(["y", "x"]);
  });

  it("leaves the input untouched", () => {
    const before = ids(files);
    sortFiles(files, { field: "name", direction: "asc" });

    expect(ids(files)).toEqual(before);
  });
});

describe("sortFolders", () => {
  const folders = [
    { id: "a", name: "reports", createdAt: new Date(Date.UTC(2026, 10, 2)) },
    { id: "b", name: "Archive", createdAt: new Date(Date.UTC(2026, 10, 3)) },
    { id: "c", name: "docs", createdAt: new Date(Date.UTC(2026, 10, 1)) },
  ];

  it("sorts by name for Name, in either direction", () => {
    expect(ids(sortFolders(folders, { field: "name", direction: "asc" }))).toEqual(["b", "c", "a"]);
    expect(ids(sortFolders(folders, { field: "name", direction: "desc" }))).toEqual(["a", "c", "b"]);
  });

  it("sorts A to Z for Size whichever way the files go, since folders have no size", () => {
    expect(ids(sortFolders(folders, { field: "size", direction: "desc" }))).toEqual(["b", "c", "a"]);
    expect(ids(sortFolders(folders, { field: "size", direction: "asc" }))).toEqual(["b", "c", "a"]);
  });

  it("sorts by creation time for Uploaded", () => {
    expect(ids(sortFolders(folders, { field: "uploaded", direction: "desc" }))).toEqual(["b", "a", "c"]);
    expect(ids(sortFolders(folders, { field: "uploaded", direction: "asc" }))).toEqual(["c", "a", "b"]);
  });
});
