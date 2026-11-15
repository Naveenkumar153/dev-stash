import type { FieldErrors } from "@/lib/action-result";
import type { EditorPreferences } from "@/lib/editor-preferences";

/** Result of `updateEditorPreferences()`: the saved preferences on success. */
export interface UpdateEditorPreferencesResult {
  success: boolean;
  data: EditorPreferences | null;
  error: string | null;
  fieldErrors: FieldErrors;
}
