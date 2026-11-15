import { z } from "zod";

import { EDITOR_FONT_SIZES, EDITOR_TAB_SIZES, EDITOR_THEMES } from "@/lib/editor-preferences";

/** The full set of editor preferences the settings page saves in one go. */
export const editorPreferencesSchema = z.object({
  fontSize: z.literal([...EDITOR_FONT_SIZES], { error: "Choose a font size from the list" }),
  tabSize: z.literal([...EDITOR_TAB_SIZES], { error: "Choose a tab size from the list" }),
  wordWrap: z.boolean({ error: "Word wrap must be on or off" }),
  minimap: z.boolean({ error: "Minimap must be on or off" }),
  theme: z.enum(EDITOR_THEMES, { error: "Choose a theme from the list" }),
});
