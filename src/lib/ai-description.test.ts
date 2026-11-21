import { describe, expect, it } from "vitest";

import {
  buildDescriptionInput,
  DESCRIPTION_INPUT_PREAMBLE,
  DESCRIPTION_INSTRUCTIONS,
  normalizeDescription,
  parseDescriptionReply,
} from "@/lib/ai-description";
import { formatItemForAi, type AiItemDraft } from "@/lib/ai-item";

const draft: AiItemDraft = {
  typeName: "note",
  title: "Postgres indexing",
  description: "",
  content: "Use a composite index when filtering and sorting together.",
  url: "",
  language: "",
  fileName: "",
  tags: ["postgres"],
};

describe("buildDescriptionInput", () => {
  it("puts the JSON preamble before the item", () => {
    expect(buildDescriptionInput(draft)).toBe(
      `${DESCRIPTION_INPUT_PREAMBLE}\n${formatItemForAi(draft)}`,
    );
  });

  it("mentions JSON in the input, which json_object mode requires", () => {
    expect(DESCRIPTION_INPUT_PREAMBLE).toMatch(/json/i);
  });

  it("asks for one or two sentences and warns against inventing link or file details", () => {
    expect(DESCRIPTION_INSTRUCTIONS).toContain("one or two plain sentences");
    expect(DESCRIPTION_INSTRUCTIONS).toContain("without inventing details");
  });
});

describe("parseDescriptionReply", () => {
  it("reads an object with a description", () => {
    expect(parseDescriptionReply('{"description": "Explains composite indexes."}')).toBe(
      "Explains composite indexes.",
    );
  });

  it("reads a bare JSON string", () => {
    expect(parseDescriptionReply('"Explains composite indexes."')).toBe(
      "Explains composite indexes.",
    );
  });

  it.each([
    "",
    "Explains composite indexes.",
    "{",
    '{"summary": "Explains composite indexes."}',
    '{"description": 42}',
    '{"description": "   "}',
    '["a", "b"]',
    "null",
  ])("returns null for %j", (reply) => {
    expect(parseDescriptionReply(reply)).toBeNull();
  });
});

describe("normalizeDescription", () => {
  it("collapses whitespace onto one line", () => {
    expect(normalizeDescription("  Debounces a value.\n\n  Useful   for search inputs. ")).toBe(
      "Debounces a value. Useful for search inputs.",
    );
  });

  it.each([
    ['"Debounces a value."', "Debounces a value."],
    ["'Debounces a value.'", "Debounces a value."],
    ["“Debounces a value.”", "Debounces a value."],
  ])("removes quotes wrapping the whole text: %s", (text, expected) => {
    expect(normalizeDescription(text)).toBe(expected);
  });

  it("keeps an apostrophe that ends the text", () => {
    expect(normalizeDescription("Notes on the platform teams'")).toBe(
      "Notes on the platform teams'",
    );
  });

  it("keeps quotes inside the text", () => {
    expect(normalizeDescription('Explains the "N+1" query problem.')).toBe(
      'Explains the "N+1" query problem.',
    );
  });

  it("caps the text at the Description field's 2,000 characters", () => {
    expect(normalizeDescription("a".repeat(2_500))).toHaveLength(2_000);
  });
});
