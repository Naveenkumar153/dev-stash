import { describe, expect, it } from "vitest";

import { AI_CONTENT_LIMIT, formatItemForAi, hasAiInput, type AiItemDraft } from "@/lib/ai-item";

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

describe("formatItemForAi", () => {
  it("wraps the item in delimiters, leaving out blank fields", () => {
    expect(formatItemForAi(draft)).toBe(
      [
        '<item type="link">',
        "<title>Tailwind docs</title>",
        "<url>https://tailwindcss.com</url>",
        "</item>",
      ].join("\n"),
    );
  });

  it("includes the language, description, content and current tags when set", () => {
    const text = formatItemForAi({
      ...draft,
      typeName: "snippet",
      description: "Utility classes",
      content: "const x = 1;",
      url: "",
      language: "typescript",
      tags: ["css", "tailwind"],
    });

    expect(text).toContain('<item type="snippet" language="typescript">');
    expect(text).toContain("<description>Utility classes</description>");
    expect(text).toContain("<content>\nconst x = 1;\n</content>");
    expect(text).toContain("<current_tags>css, tailwind</current_tags>");
  });

  it("includes a file item's file name", () => {
    const text = formatItemForAi({ ...draft, typeName: "file", url: "", fileName: "q3-report.pdf" });

    expect(text).toContain('<item type="file">');
    expect(text).toContain("<file_name>q3-report.pdf</file_name>");
  });

  it("leaves content out when it's only whitespace", () => {
    expect(formatItemForAi({ ...draft, content: "  \n " })).not.toContain("<content>");
  });

  it("cuts content at the limit and marks it truncated", () => {
    const exact = formatItemForAi({ ...draft, content: "a".repeat(AI_CONTENT_LIMIT) });
    expect(exact).not.toContain("[...truncated]");

    const long = formatItemForAi({ ...draft, content: `${"a".repeat(AI_CONTENT_LIMIT)}b` });
    expect(long).toContain(`${"a".repeat(AI_CONTENT_LIMIT)}\n[...truncated]`);
    expect(long).not.toContain("ab");
  });
});

describe("hasAiInput", () => {
  const blank = { title: "", content: "", url: "", fileName: "" };

  it("is false when every field is blank or whitespace", () => {
    expect(hasAiInput(blank)).toBe(false);
    expect(hasAiInput({ title: " ", content: "\n\t", url: "  ", fileName: " " })).toBe(false);
  });

  it.each([
    ["a title", { title: "Notes" }],
    ["content", { content: "echo hi" }],
    ["a URL", { url: "https://example.com" }],
    ["a file name", { fileName: "diagram.png" }],
  ])("is true with %s alone", (_label, field) => {
    expect(hasAiInput({ ...blank, ...field })).toBe(true);
  });
});
