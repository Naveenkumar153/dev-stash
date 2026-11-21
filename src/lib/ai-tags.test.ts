import { describe, expect, it } from "vitest";

import {
  AI_TAG_CONTENT_LIMIT,
  buildTagInput,
  MAX_TAG_SUGGESTIONS,
  normalizeTagName,
  normalizeTagSuggestions,
  parseTagReply,
  TAG_INPUT_PREAMBLE,
  type TagDraft,
} from "@/lib/ai-tags";

const draft: TagDraft = {
  typeName: "link",
  title: "Tailwind docs",
  description: "",
  content: "",
  url: "https://tailwindcss.com",
  language: "",
  tags: [],
};

describe("buildTagInput", () => {
  it("wraps the item in delimiters after the preamble, leaving out blank fields", () => {
    expect(buildTagInput(draft)).toBe(
      [
        TAG_INPUT_PREAMBLE,
        '<item type="link">',
        "<title>Tailwind docs</title>",
        "<url>https://tailwindcss.com</url>",
        "</item>",
      ].join("\n"),
    );
  });

  it("mentions JSON in the input, which json_object mode requires", () => {
    expect(buildTagInput(draft)).toMatch(/json/i);
  });

  it("includes the language, description, content and current tags when set", () => {
    const input = buildTagInput({
      ...draft,
      typeName: "snippet",
      description: "Utility classes",
      content: "const x = 1;",
      url: "",
      language: "typescript",
      tags: ["css", "tailwind"],
    });

    expect(input).toContain('<item type="snippet" language="typescript">');
    expect(input).toContain("<description>Utility classes</description>");
    expect(input).toContain("<content>\nconst x = 1;\n</content>");
    expect(input).toContain("<current_tags>css, tailwind</current_tags>");
  });

  it("leaves content out when it's only whitespace", () => {
    expect(buildTagInput({ ...draft, content: "  \n " })).not.toContain("<content>");
  });

  it("cuts content at the limit and marks it truncated", () => {
    const exact = buildTagInput({ ...draft, content: "a".repeat(AI_TAG_CONTENT_LIMIT) });
    expect(exact).not.toContain("[...truncated]");

    const long = buildTagInput({ ...draft, content: `${"a".repeat(AI_TAG_CONTENT_LIMIT)}b` });
    expect(long).toContain(`${"a".repeat(AI_TAG_CONTENT_LIMIT)}\n[...truncated]`);
    expect(long).not.toContain("ab");
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
