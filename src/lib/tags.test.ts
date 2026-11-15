import { describe, expect, it } from "vitest";

import { parseTagInput } from "@/lib/tags";

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
