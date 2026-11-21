import { describe, expect, it } from "vitest";

import { acceptSuggestedTag, addTagToInput, parseTagInput } from "@/lib/tags";

describe("parseTagInput", () => {
  it("splits on commas and trims each name", () => {
    expect(parseTagInput(" react,hooks ,  typescript ")).toEqual(["react", "hooks", "typescript"]);
  });

  it("drops blank entries", () => {
    expect(parseTagInput("react, , ,hooks,")).toEqual(["react", "hooks"]);
    expect(parseTagInput("   ")).toEqual([]);
    expect(parseTagInput("")).toEqual([]);
  });

  it("keeps each name once, in the order typed", () => {
    expect(parseTagInput("hooks, react, hooks")).toEqual(["hooks", "react"]);
  });

  it("keeps the case as typed", () => {
    expect(parseTagInput("React, react")).toEqual(["React", "react"]);
  });
});

describe("addTagToInput", () => {
  it("appends the tag after the existing ones", () => {
    expect(addTagToInput("react, hooks", "state")).toBe("react, hooks, state");
  });

  it("starts an empty input with the tag", () => {
    expect(addTagToInput("", "react")).toBe("react");
    expect(addTagToInput("  ", "react")).toBe("react");
  });

  it("tidies stray commas and spaces as it appends", () => {
    expect(addTagToInput(" react,, hooks , ", "state")).toBe("react, hooks, state");
  });

  it("leaves the input as typed when it already has the tag, ignoring case", () => {
    expect(addTagToInput("React , hooks", "react")).toBe("React , hooks");
  });
});

describe("acceptSuggestedTag", () => {
  it("adds a new tag to the input", () => {
    expect(acceptSuggestedTag("react, hooks", "state", 20)).toEqual({
      status: "added",
      tags: "react, hooks, state",
    });
  });

  it("leaves the input as it was when the tag is already there, ignoring case", () => {
    expect(acceptSuggestedTag("React, hooks", "react", 20)).toEqual({
      status: "present",
      tags: "React, hooks",
    });
  });

  it("refuses a new tag once the input is at the limit", () => {
    expect(acceptSuggestedTag("a, b, c", "d", 3)).toEqual({ status: "full" });
  });

  it("still reports a tag already there as present at the limit", () => {
    expect(acceptSuggestedTag("a, b, c", "B", 3)).toEqual({ status: "present", tags: "a, b, c" });
  });

  it("adds a tag that brings the input up to the limit", () => {
    expect(acceptSuggestedTag("a, b", "c", 3)).toEqual({ status: "added", tags: "a, b, c" });
  });
});
