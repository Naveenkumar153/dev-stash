import { describe, expect, it } from "vitest";

import {
  getItemPreview,
  SEARCH_PREVIEW_LENGTH,
  toSearchCollection,
  toSearchPreview,
} from "@/lib/search";

describe("toSearchPreview", () => {
  it("returns null for missing or blank text", () => {
    expect(toSearchPreview(null)).toBeNull();
    expect(toSearchPreview(undefined)).toBeNull();
    expect(toSearchPreview("")).toBeNull();
    expect(toSearchPreview(" \n\t ")).toBeNull();
  });

  it("collapses whitespace and newlines to single spaces and trims", () => {
    expect(toSearchPreview("  git   status\n\n  git diff\t--stat  ")).toBe("git status git diff --stat");
  });

  it("keeps text at exactly the limit whole", () => {
    const text = "a".repeat(SEARCH_PREVIEW_LENGTH);

    expect(toSearchPreview(text)).toBe(text);
  });

  it("cuts longer text to the limit with an ellipsis, without a trailing space", () => {
    expect(toSearchPreview("one two three", 4)).toBe("one…");
    expect(toSearchPreview("a".repeat(SEARCH_PREVIEW_LENGTH + 1))).toBe(
      `${"a".repeat(SEARCH_PREVIEW_LENGTH)}…`,
    );
  });
});

describe("getItemPreview", () => {
  it("prefers a link's URL, then a file name, then the content", () => {
    expect(getItemPreview({ content: "notes", url: "https://a.dev", fileName: "a.pdf" })).toBe(
      "https://a.dev",
    );
    expect(getItemPreview({ content: "notes", url: null, fileName: "a.pdf" })).toBe("a.pdf");
    expect(getItemPreview({ content: "notes", url: " ", fileName: null })).toBe("notes");
  });

  it("returns null when the item has no payload", () => {
    expect(getItemPreview({ content: null, url: null, fileName: null })).toBeNull();
  });
});

describe("toSearchCollection", () => {
  it("keeps only the fields the palette shows", () => {
    expect(
      toSearchCollection({
        id: "col-1",
        name: "React Patterns",
        description: "Hooks and more",
        isFavorite: true,
        itemCount: 3,
        dominantTypeName: "snippet",
        typeNames: ["snippet", "note"],
      }),
    ).toEqual({ id: "col-1", name: "React Patterns", itemCount: 3, dominantTypeName: "snippet" });
  });
});
