import { describe, expect, it } from "vitest";

import { formatItemForAi, type AiItemDraft } from "@/lib/ai-item";
import {
  buildTagInput,
  MAX_TAG_SUGGESTIONS,
  normalizeTagName,
  normalizeTagSuggestions,
  parseTagReply,
  TAG_INPUT_PREAMBLE,
} from "@/lib/ai-tags";

const draft: AiItemDraft = {
  typeName: "link",
  title: "Tailwind docs",
  description: "",
  content: "",
  url: "https://tailwindcss.com",
  language: "",
  fileName: "",
  tags: [],
};

// The item text itself is covered in ai-item.test.ts.
describe("buildTagInput", () => {
  it("puts the JSON preamble before the item", () => {
    expect(buildTagInput(draft)).toBe(`${TAG_INPUT_PREAMBLE}\n${formatItemForAi(draft)}`);
  });

  it("mentions JSON in the input, which json_object mode requires", () => {
    expect(TAG_INPUT_PREAMBLE).toMatch(/json/i);
  });
});

describe("parseTagReply", () => {
  it("reads an object with a tags array", () => {
    expect(parseTagReply('{"tags": ["react", "hooks"]}')).toEqual(["react", "hooks"]);
  });

  it("reads a bare array", () => {
    expect(parseTagReply('["react", "hooks"]')).toEqual(["react", "hooks"]);
  });

  it("drops entries that aren't strings", () => {
    expect(parseTagReply('{"tags": ["react", 3, null, {"a": 1}, "hooks"]}')).toEqual(["react", "hooks"]);
  });

  it.each(["", "react, hooks", "{", '{"labels": []}', '{"tags": "react"}', '"react"', "null", "42"])(
    "returns null for %j",
    (reply) => {
      expect(parseTagReply(reply)).toBeNull();
    },
  );
});

describe("normalizeTagName", () => {
  it.each([
    ["React", "react"],
    ["  React Hooks ", "react-hooks"],
    ["#TypeScript", "typescript"],
    ["docker_compose", "docker-compose"],
    ["C++", "c++"],
    ["C#", "c#"],
    ["Node.js", "node.js"],
    ["state  -- management", "state-management"],
    ["-edge-", "edge"],
    ["what?!", "what"],
    ["Café", "café"],
  ])("%j -> %j", (name, tag) => {
    expect(normalizeTagName(name)).toBe(tag);
  });

  it("caps a tag at 50 characters", () => {
    expect(normalizeTagName("a".repeat(80))).toHaveLength(50);
  });

  it("can come out empty", () => {
    expect(normalizeTagName(" !!! ")).toBe("");
  });
});

describe("normalizeTagSuggestions", () => {
  it("normalizes, drops blanks and keeps each tag once", () => {
    expect(normalizeTagSuggestions(["React", "react", "  ", "Hooks"], [])).toEqual(["react", "hooks"]);
  });

  it("skips tags the item already has, ignoring case", () => {
    expect(normalizeTagSuggestions(["react", "hooks"], [" React "])).toEqual(["hooks"]);
  });

  it("returns at most five", () => {
    const suggested = ["a", "b", "c", "d", "e", "f", "g"];
    expect(normalizeTagSuggestions(suggested, [])).toHaveLength(MAX_TAG_SUGGESTIONS);
  });

  it("stays within the item's 20-tag limit", () => {
    const current = Array.from({ length: 18 }, (_, i) => `tag-${i}`);
    expect(normalizeTagSuggestions(["a", "b", "c"], current)).toEqual(["a", "b"]);
  });

  it("returns nothing when the item is already at or past the limit", () => {
    const full = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    expect(normalizeTagSuggestions(["a"], full)).toEqual([]);
  });
});
