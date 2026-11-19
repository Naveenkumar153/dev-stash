import { cache } from "react";

import {
  DEFAULT_EDITOR_PREFERENCES,
  parseEditorPreferences,
  type EditorPreferences,
} from "@/lib/editor-preferences";
import { getSessionUserRow } from "@/lib/db/user";

/**
 * The signed-in user's editor preferences, from the same cached row as
 * `getSessionUser()`. Defaults when signed out or the user has never saved any,
 * and for any stored key that isn't a valid value.
 */
export const getEditorPreferences = cache(async (): Promise<EditorPreferences> => {
  const user = await getSessionUserRow();
  return user ? parseEditorPreferences(user.editorPreferences) : DEFAULT_EDITOR_PREFERENCES;
});
