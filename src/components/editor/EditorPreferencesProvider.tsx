"use client";

import { createContext, useContext } from "react";

import { DEFAULT_EDITOR_PREFERENCES, type EditorPreferences } from "@/lib/editor-preferences";

const EditorPreferencesContext = createContext<EditorPreferences>(DEFAULT_EDITOR_PREFERENCES);

interface EditorPreferencesProviderProps {
  preferences: EditorPreferences;
  children: React.ReactNode;
}

/**
 * Gives client components the signed-in user's editor preferences. The app
 * shell loads them on the server, so a change saved on /settings shows up the
 * next time the shell renders.
 */
export function EditorPreferencesProvider({
  preferences,
  children,
}: Readonly<EditorPreferencesProviderProps>) {
  return (
    <EditorPreferencesContext.Provider value={preferences}>
      {children}
    </EditorPreferencesContext.Provider>
  );
}

/** The current editor preferences; the defaults outside a provider. */
export function useEditorPreferences(): EditorPreferences {
  return useContext(EditorPreferencesContext);
}
