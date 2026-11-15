import { describe, expect, it } from "vitest";

import {
  getPageHref,
  getPageNumbers,
  getPageSkip,
  getTotalPages,
  parsePageParam,
} from "@/lib/pagination";

describe("parsePageParam", () => {
  it("reads a missing parameter as page 1", () => {
    expect(parsePageParam(undefined)).toBe(1);
  });

  it.each([
    ["1", 1],
    ["2", 2],
    ["40", 40],
  ])("reads %s as page %i", (param, page) => {
    expect(parsePageParam(param)).toBe(page);
  });

  it.each(["", "0", "-1", "02", "1.5", "2.0", "+2", " 2", "1e2", "abc", "Infinity"])(
    "rejects %j",
    (param) => {
      expect(parsePageParam(param)).toBeNull();
    },
  );

  it("rejects a number too large to be exact", () => {
    expect(parsePageParam("9007199254740993")).toBeNull();
  });

  it("rejects a repeated parameter", () => {
    expect(parsePageParam(["1", "2"])).toBeNull();
  });
});

describe("getTotalPages", () => {
  it.each([
    [0, 1],
    [1, 1],
    [21, 1],
    [22, 2],
    [42, 2],
    [43, 3],
  ])("fits %i rows of 21 on %i page(s)", (total, pages) => {
    expect(getTotalPages(total, 21)).toBe(pages);
  });
});

describe("getPageSkip", () => {
  it("skips the rows of every earlier page", () => {
    expect(getPageSkip(1, 21)).toBe(0);
    expect(getPageSkip(2, 21)).toBe(21);
    expect(getPageSkip(5, 21)).toBe(84);
  });
});

describe("getPageNumbers", () => {
  it("shows a single page alone", () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
  });

  it("shows every page when there are few", () => {
    expect(getPageNumbers(1, 2)).toEqual([1, 2]);
    expect(getPageNumbers(2, 3)).toEqual([1, 2, 3]);
    expect(getPageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts an ellipsis after the start when far from the end", () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, "ellipsis", 10]);
  });

  it("puts an ellipsis before the end when far from the start", () => {
    expect(getPageNumbers(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });

  it("puts ellipses on both sides of a page in the middle", () => {
    expect(getPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
  });

  it("shows a single left-out page instead of an ellipsis", () => {
    expect(getPageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    expect(getPageNumbers(7, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
  });
});

describe("getPageHref", () => {
  it("leaves the parameter off page 1", () => {
    expect(getPageHref("/items/snippets", 1)).toBe("/items/snippets");
  });

  it("adds the page to every other page", () => {
    expect(getPageHref("/collections", 3)).toBe("/collections?page=3");
  });
});
