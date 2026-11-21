import { describe, expect, it } from "vitest";

import {
  CODE_EDITOR_LINE_HEIGHT,
  CODE_EDITOR_MAX_HEIGHT,
  CODE_LANGUAGES,
  clampEditorHeight,
  estimateEditorHeight,
  findCodeLanguage,
  getEditorLineHeight,
  getLanguageLabel,
  getLanguageOptions,
  PLAIN_TEXT_LABEL,
  PLAIN_TEXT_LANGUAGE,
  toLanguageSelectValue,
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

  it("uses the line height it's given, for a larger font", () => {
    expect(estimateEditorHeight("a\nb\nc", 0, 28)).toBe(108);
  });
});

describe("getEditorLineHeight", () => {
  it("keeps the original 20px line height at the default 13px font", () => {
    expect(getEditorLineHeight(13)).toBe(CODE_EDITOR_LINE_HEIGHT);
  });

  it.each([
    [12, 18],
    [14, 22],
    [16, 25],
    [18, 28],
  ])("scales %spx text to a %spx line", (fontSize, lineHeight) => {
    expect(getEditorLineHeight(fontSize)).toBe(lineHeight);
  });
});

describe("CODE_LANGUAGES", () => {
  it("lists each value once, lowercase and trimmed", () => {
    const values = CODE_LANGUAGES.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(value).toBe(value.trim().toLowerCase());
    }
  });

  it("doesn't list plain text, which stores no language", () => {
    expect(CODE_LANGUAGES.some((option) => option.value === PLAIN_TEXT_LANGUAGE)).toBe(false);
  });
});

describe("findCodeLanguage", () => {
  it("finds a listed language ignoring case and spaces", () => {
    expect(findCodeLanguage(" TypeScript ")).toEqual({ value: "typescript", label: "TypeScript" });
    expect(findCodeLanguage("bash")?.label).toBe("Bash");
  });

  it.each([null, undefined, "", "   ", "haskell", "ts", "constructor"])(
    "finds nothing for %j",
    (language) => {
      expect(findCodeLanguage(language)).toBeUndefined();
    },
  );
});

describe("getLanguageLabel", () => {
  it("uses the listed label", () => {
    expect(getLanguageLabel("cpp")).toBe("C++");
    expect(getLanguageLabel("CSHARP")).toBe("C#");
  });

  it("shows an unlisted value as typed, trimmed", () => {
    expect(getLanguageLabel("  haskell ")).toBe("haskell");
  });

  it.each([null, undefined, "", "  ", "plaintext", " PlainText "])("reads %j as plain text", (language) => {
    expect(getLanguageLabel(language)).toBe(PLAIN_TEXT_LABEL);
  });
});

describe("getLanguageOptions", () => {
  it.each([null, undefined, "", " ", "typescript", "Bash", "plaintext", "PlainText"])(
    "is the listed languages for %j",
    (language) => {
      expect(getLanguageOptions(language)).toBe(CODE_LANGUAGES);
    },
  );

  it("adds an unlisted value, trimmed, after the listed ones", () => {
    const options = getLanguageOptions(" ts ");

    expect(options).toHaveLength(CODE_LANGUAGES.length + 1);
    expect(options.at(-1)).toEqual({ value: "ts", label: "ts" });
  });
});

describe("toLanguageSelectValue", () => {
  it.each([null, undefined, "", "  ", "plaintext", "PlainText"])(
    "selects plain text for %j",
    (language) => {
      expect(toLanguageSelectValue(language)).toBe(PLAIN_TEXT_LANGUAGE);
    },
  );

  it("selects the listed value whatever the stored case", () => {
    expect(toLanguageSelectValue(" TypeScript ")).toBe("typescript");
  });

  it("selects an unlisted value as typed, trimmed, matching its extra option", () => {
    expect(toLanguageSelectValue(" ts ")).toBe("ts");
    expect(getLanguageOptions(" ts ").map((option) => option.value)).toContain("ts");
  });
});

describe("listed languages and Monaco", () => {
  it("map every listed value to a bundled grammar", () => {
    // The Monaco ids the listed values should resolve to, so a typo in the
    // list (or a grammar that isn't bundled) shows up here.
    const bundled = new Set([
      "shell", "c", "cpp", "csharp", "css", "dockerfile", "go", "graphql", "html", "java",
      "javascript", "kotlin", "markdown", "php", "powershell", "python", "ruby", "rust", "scss",
      "sql", "swift", "typescript", "yaml",
    ]);

    for (const { value } of CODE_LANGUAGES) {
      expect(bundled).toContain(toMonacoLanguage(value));
    }
  });
});
