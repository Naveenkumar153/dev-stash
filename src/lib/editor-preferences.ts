/** Font sizes (px) the Monaco editor offers. 13 is the size it shipped with. */
export const EDITOR_FONT_SIZES = [12, 13, 14, 16, 18] as const;

/** Tab widths (spaces) the Monaco editor offers. */
export const EDITOR_TAB_SIZES = [2, 4, 8] as const;

/** Editor themes, by the value stored in `User.editorPreferences`. */
export const EDITOR_THEMES = ["vs-dark", "monokai", "github-dark"] as const;

export type EditorFontSize = (typeof EDITOR_FONT_SIZES)[number];
export type EditorTabSize = (typeof EDITOR_TAB_SIZES)[number];
export type EditorTheme = (typeof EDITOR_THEMES)[number];

export interface EditorPreferences {
  fontSize: EditorFontSize;
  tabSize: EditorTabSize;
  wordWrap: boolean;
  minimap: boolean;
  theme: EditorTheme;
}

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
  theme: "vs-dark",
};

export const EDITOR_THEME_LABELS: Record<EditorTheme, string> = {
  "vs-dark": "VS Dark",
  monokai: "Monokai",
  "github-dark": "GitHub Dark",
};

/** Whether `value` is one of `options`, narrowing it to their type. */
function isOneOf<T extends string | number>(options: readonly T[], value: unknown): value is T {
  return options.includes(value as T);
}

/**
 * Editor preferences from whatever is stored in `User.editorPreferences`: null
 * for a user who never changed anything, or JSON that may be partial, from an
 * older shape, or edited by hand. Each key that is missing or not an allowed
 * value falls back to its default, so a bad entry never breaks the editor.
 */
export function parseEditorPreferences(value: unknown): EditorPreferences {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const stored: Record<string, unknown> = { ...value };
  const defaults = DEFAULT_EDITOR_PREFERENCES;

  return {
    fontSize: isOneOf(EDITOR_FONT_SIZES, stored.fontSize) ? stored.fontSize : defaults.fontSize,
    tabSize: isOneOf(EDITOR_TAB_SIZES, stored.tabSize) ? stored.tabSize : defaults.tabSize,
    wordWrap: typeof stored.wordWrap === "boolean" ? stored.wordWrap : defaults.wordWrap,
    minimap: typeof stored.minimap === "boolean" ? stored.minimap : defaults.minimap,
    theme: isOneOf(EDITOR_THEMES, stored.theme) ? stored.theme : defaults.theme,
  };
}
