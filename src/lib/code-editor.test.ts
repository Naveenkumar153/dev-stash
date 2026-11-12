import { describe, expect, it } from "vitest";

import {
  CODE_EDITOR_MAX_HEIGHT,
  clampEditorHeight,
  estimateEditorHeight,
  PLAIN_TEXT_LANGUAGE,
  toMonacoLanguage,
} from "@/lib/code-editor";

describe("toMonacoLanguage", () => {
  it.each([
    ["bash", "shell"],
    ["sh", "shell"],
    ["ts", "typescript"],
    ["json", "javascript"],
    ["yml", "yaml"],
    ["protobuf", "proto"],
  ])("maps %s to Monaco's %s", (language, id) => {
    expect(toMonacoLanguage(language)).toBe(id);
  });

  it("passes Monaco ids through", () => {
    expect(toMonacoLanguage("typescript")).toBe("typescript");
    expect(toMonacoLanguage("dockerfile")).toBe("dockerfile");
  });

  it("trims and lowercases what was typed", () => {
    expect(toMonacoLanguage("  TypeScript ")).toBe("typescript");
    expect(toMonacoLanguage("BASH")).toBe("shell");
  });

  it("passes unknown languages through for Monaco to show as plain text", () => {
    expect(toMonacoLanguage("haskell")).toBe("haskell");
  });

  it("doesn't match inherited object properties", () => {
    expect(toMonacoLanguage("constructor")).toBe("constructor");
    expect(toMonacoLanguage("__proto__")).toBe("__proto__");
  });

  it.each([null, undefined, "", "   "])("uses plain text for %j", (language) => {
    expect(toMonacoLanguage(language)).toBe(PLAIN_TEXT_LANGUAGE);
  });
});

describe("clampEditorHeight", () => {
  it("keeps a height between the floor and the max", () => {
    expect(clampEditorHeight(200, 160)).toBe(200);
  });

  it("raises a short editor to the floor", () => {
    expect(clampEditorHeight(44, 160)).toBe(160);
  });

  it("caps a tall editor at the max", () => {
    expect(clampEditorHeight(2000)).toBe(CODE_EDITOR_MAX_HEIGHT);
  });
});

describe("estimateEditorHeight", () => {
  it("sizes one line plus padding", () => {
    expect(estimateEditorHeight("npm test")).toBe(44);
  });

  it("adds a line height per line", () => {
    expect(estimateEditorHeight("a\nb\nc")).toBe(84);
  });

  it("caps long content and respects the floor", () => {
    expect(estimateEditorHeight("x\n".repeat(100))).toBe(CODE_EDITOR_MAX_HEIGHT);
    expect(estimateEditorHeight("", 160)).toBe(160);
  });
});
