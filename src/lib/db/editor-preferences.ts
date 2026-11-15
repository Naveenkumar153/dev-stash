import { cache } from "react";

import { auth } from "@/auth";
import {
  DEFAULT_EDITOR_PREFERENCES,
  parseEditorPreferences,
  type EditorPreferences,
} from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";

/**
 * The signed-in user's editor preferences, read from their row by session id
 * like `getSessionUser()`. Defaults when signed out or the user has never saved
 * any, and for any stored key that isn't a valid value.
 */
export const getEditorPreferences = cache(async (): Promise<EditorPreferences> => {
  const session = await auth();
  if (!session?.user?.id) {
    return DEFAULT_EDITOR_PREFERENCES;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { editorPreferences: true },
  });

  return parseEditorPreferences(user?.editorPreferences);
});
