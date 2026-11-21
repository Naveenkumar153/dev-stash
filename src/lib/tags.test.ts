import { describe, expect, it } from "vitest";

import { addTagToInput, parseTagInput } from "@/lib/tags";

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
