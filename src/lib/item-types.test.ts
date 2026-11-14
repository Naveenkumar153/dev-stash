import { describe, expect, it } from "vitest";

import {
  compareItemTypeOrder,
  getContentEditorKind,
  getCreatableTypeFromPath,
  getEditableItemFields,
  getItemTypeHref,
  getItemTypeLabel,
  getItemTypePlural,
  getItemTypeSlug,
  getItemTypeStyleByName,
  isCreatableItemType,
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

describe("getEditableItemFields", () => {
  it.each(["snippet", "command"])("gives %s content and a language", (name) => {
    expect(getEditableItemFields(name)).toEqual({ content: true, language: true, url: false });
  });

  it.each(["prompt", "note"])("gives %s content but no language", (name) => {
    expect(getEditableItemFields(name)).toEqual({ content: true, language: false, url: false });
  });

  it("gives a link only its URL", () => {
    expect(getEditableItemFields("link")).toEqual({ content: false, language: false, url: true });
  });

  it.each(["file", "image", "recipe"])("gives %s none of them", (name) => {
    expect(getEditableItemFields(name)).toEqual({ content: false, language: false, url: false });
  });

  it("ignores case", () => {
    expect(getEditableItemFields("Snippet")).toEqual(getEditableItemFields("snippet"));
  });
});

describe("getContentEditorKind", () => {
  it.each(["snippet", "command", "Snippet"])("edits %s as code", (name) => {
    expect(getContentEditorKind(name)).toBe("code");
  });

  it.each(["prompt", "note", "Note"])("edits %s as markdown", (name) => {
    expect(getContentEditorKind(name)).toBe("markdown");
  });

  it.each(["link", "file", "recipe"])("falls back to plain text for %s", (name) => {
    expect(getContentEditorKind(name)).toBe("plain");
  });
});

describe("getCreatableTypeFromPath", () => {
  it.each([
    ["/items/snippets", "snippet"],
    ["/items/commands", "command"],
    ["/items/notes/", "note"],
    ["/items/links", "link"],
  ])("reads %s as %s", (pathname, type) => {
    expect(getCreatableTypeFromPath(pathname)).toBe(type);
  });

  it.each(["/items/files", "/items/images", "/items/recipes", "/dashboard", "/items", "/items/notes/x"])(
    "finds no creatable type on %s",
    (pathname) => {
      expect(getCreatableTypeFromPath(pathname)).toBeNull();
    },
  );
});

describe("isCreatableItemType", () => {
  it.each(["snippet", "prompt", "command", "note", "link"])("lets the dialog create %s", (name) => {
    expect(isCreatableItemType(name)).toBe(true);
  });

  it.each(["file", "image", "recipe", "Snippet"])("refuses %s", (name) => {
    expect(isCreatableItemType(name)).toBe(false);
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
