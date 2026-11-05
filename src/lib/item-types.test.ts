import { describe, expect, it } from "vitest";

import {
  compareItemTypeOrder,
  getItemTypeHref,
  getItemTypeLabel,
  getItemTypePlural,
  getItemTypeSlug,
  getItemTypeStyleByName,
  isProItemType,
} from "@/lib/item-types";

describe("type naming", () => {
  it("builds the list slug and route from the type name", () => {
    expect(getItemTypeSlug("snippet")).toBe("snippets");
    expect(getItemTypeHref("snippet")).toBe("/items/snippets");
  });

  it("lowercases the slug, so each list has one URL", () => {
    expect(getItemTypeSlug("Snippet")).toBe("snippets");
  });

  it("capitalizes labels", () => {
    expect(getItemTypeLabel("command")).toBe("Command");
    expect(getItemTypePlural("command")).toBe("Commands");
  });
});

describe("getItemTypeStyleByName", () => {
  it("returns the type's own color classes", () => {
    expect(getItemTypeStyleByName("link").borderClass).toBe("border-l-type-link");
  });

  it("ignores case", () => {
    expect(getItemTypeStyleByName("LINK")).toBe(getItemTypeStyleByName("link"));
  });

  it("falls back to neutral styling for a custom type", () => {
    expect(getItemTypeStyleByName("recipe").borderClass).toBe("border-l-border");
  });
});

describe("isProItemType", () => {
  it.each(["file", "image", "Image"])("marks %s as Pro", (name) => {
    expect(isProItemType(name)).toBe(true);
  });

  it.each(["snippet", "prompt", "command", "note", "link"])("leaves %s free", (name) => {
    expect(isProItemType(name)).toBe(false);
  });
});

describe("compareItemTypeOrder", () => {
  it("sorts system types into display order", () => {
    expect(["link", "note", "snippet", "image"].sort(compareItemTypeOrder)).toEqual([
      "snippet",
      "note",
      "image",
      "link",
    ]);
  });

  it("puts custom types after the system ones, alphabetically", () => {
    expect(["zebra", "link", "apple", "snippet"].sort(compareItemTypeOrder)).toEqual([
      "snippet",
      "link",
      "apple",
      "zebra",
    ]);
  });
});
