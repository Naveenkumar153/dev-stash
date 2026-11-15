import { describe, expect, it } from "vitest";

import { getFieldErrors } from "@/lib/action-result";
import { editorPreferencesSchema } from "@/lib/editor-preference-schemas";
import {
  DEFAULT_EDITOR_PREFERENCES,
  EDITOR_FONT_SIZES,
  EDITOR_TAB_SIZES,
  EDITOR_THEMES,
} from "@/lib/editor-preferences";

const valid = { fontSize: 14, tabSize: 4, wordWrap: false, minimap: true, theme: "github-dark" };

function errorsFor(input: unknown) {
  const result = editorPreferencesSchema.safeParse(input);
  return result.success ? {} : getFieldErrors(result.error);
}

describe("editorPreferencesSchema", () => {
  it("accepts a full, valid set", () => {
    expect(editorPreferencesSchema.parse(valid)).toEqual(valid);
  });

  it("accepts the defaults", () => {
    expect(editorPreferencesSchema.parse(DEFAULT_EDITOR_PREFERENCES)).toEqual(
      DEFAULT_EDITOR_PREFERENCES,
    );
  });

  it("accepts every option the settings page offers", () => {
    for (const fontSize of EDITOR_FONT_SIZES) {
      for (const tabSize of EDITOR_TAB_SIZES) {
        for (const theme of EDITOR_THEMES) {
          expect(editorPreferencesSchema.safeParse({ ...valid, fontSize, tabSize, theme }).success).toBe(
            true,
          );
        }
      }
    }
  });

  it("strips keys it doesn't know, so nothing else reaches the JSON column", () => {
    expect(editorPreferencesSchema.parse({ ...valid, isPro: true })).toEqual(valid);
  });

  it("rejects values outside the lists, per field", () => {
    expect(errorsFor({ ...valid, fontSize: 15 })).toEqual({
      fontSize: "Choose a font size from the list",
    });
    expect(errorsFor({ ...valid, tabSize: "4" })).toEqual({
      tabSize: "Choose a tab size from the list",
    });
    expect(errorsFor({ ...valid, theme: "solarized" })).toEqual({
      theme: "Choose a theme from the list",
    });
  });

  it("rejects toggles that aren't booleans", () => {
    expect(errorsFor({ ...valid, wordWrap: "true", minimap: 1 })).toEqual({
      wordWrap: "Word wrap must be on or off",
      minimap: "Minimap must be on or off",
    });
  });

  it("requires every field, since the whole set is replaced", () => {
    expect(Object.keys(errorsFor({ theme: "monokai" })).sort()).toEqual([
      "fontSize",
      "minimap",
      "tabSize",
      "wordWrap",
    ]);
  });

  it("rejects a non-object", () => {
    expect(editorPreferencesSchema.safeParse(null).success).toBe(false);
  });
});
