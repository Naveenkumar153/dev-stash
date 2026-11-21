"use server";

import {
  EDITOR_PREFERENCES_SAVE_FAILED,
  SESSION_EXPIRED,
  formFailure,
  getFieldErrors,
} from "@/lib/action-result";
import { editorPreferencesSchema } from "@/lib/editor-preference-schemas";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import type { UpdateEditorPreferencesResult } from "@/types/editor-preferences";

/**
 * Saves the signed-in user's editor preferences. The whole set is replaced, so
 * the settings page sends all five values on every change.
 */
export async function updateEditorPreferences(
  data: unknown,
): Promise<UpdateEditorPreferencesResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return formFailure(SESSION_EXPIRED);
  }

  const parsed = editorPreferencesSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, data: null, error: null, fieldErrors: getFieldErrors(parsed.error) };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { editorPreferences: parsed.data },
    });
    return { success: true, data: parsed.data, error: null, fieldErrors: {} };
  } catch (error) {
    console.error("Saving editor preferences failed", error);
    return formFailure(EDITOR_PREFERENCES_SAVE_FAILED);
  }
}
