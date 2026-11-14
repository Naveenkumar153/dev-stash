import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILE_FILTERS,
  FILE_TYPE_FILTERS,
  getDateFilterStart,
  getFileCategory,
  isFileFilterActive,
  matchesFileFilters,
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
