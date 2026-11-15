import { describe, expect, it } from "vitest";

import { DEFAULT_EDITOR_PREFERENCES, parseEditorPreferences } from "@/lib/editor-preferences";

describe("parseEditorPreferences", () => {
  it("keeps a complete, valid set as stored", () => {
    const stored = { fontSize: 18, tabSize: 4, wordWrap: false, minimap: true, theme: "monokai" };

    expect(parseEditorPreferences(stored)).toEqual(stored);
  });

  it("gives the defaults for a user who never saved any (null)", () => {
    expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it("matches the spec's defaults: wrap on, minimap off, vs-dark", () => {
    expect(DEFAULT_EDITOR_PREFERENCES).toMatchObject({
      wordWrap: true,
      minimap: false,
      theme: "vs-dark",
    });
  });

  it.each([["a string", "monokai"], ["a number", 14], ["an array", [18, 4]], ["undefined", undefined]])(
    "gives the defaults for %s",
    (_, value) => {
      expect(parseEditorPreferences(value)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    },
  );

  it("fills missing keys from the defaults, keeping the ones that are there", () => {
    expect(parseEditorPreferences({ theme: "github-dark", minimap: true })).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      theme: "github-dark",
      minimap: true,
    });
  });

  it("replaces each invalid key with its default, independently of the others", () => {
    expect(
      parseEditorPreferences({
        fontSize: 15,
        tabSize: "4",
        wordWrap: "yes",
        minimap: 1,
        theme: "solarized",
      }),
    ).toEqual(DEFAULT_EDITOR_PREFERENCES);

    expect(parseEditorPreferences({ fontSize: 16, tabSize: 3 })).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      fontSize: 16,
    });
  });

  it("drops keys it doesn't know", () => {
    expect(parseEditorPreferences({ fontSize: 12, lineNumbers: "off" })).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      fontSize: 12,
    });
  });

  it("doesn't take a value from the prototype chain", () => {
    const inherited = Object.create({ theme: "monokai", fontSize: 18 });

    expect(parseEditorPreferences(inherited)).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});
