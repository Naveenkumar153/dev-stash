"use client";

import Editor, { loader, type OnChange, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/register.all";
import { useMemo, useState } from "react";

import { useEditorPreferences } from "@/components/editor/EditorPreferencesProvider";
import {
  CODE_EDITOR_PADDING,
  clampEditorHeight,
  estimateEditorHeight,
  getEditorLineHeight,
  toMonacoLanguage,
} from "@/lib/code-editor";
import type { EditorTheme } from "@/lib/editor-preferences";

// Use this bundled copy of Monaco instead of the wrapper's default, which
// downloads one from a CDN at runtime.
loader.config({ monaco });

// Monaco runs its text computations in a web worker. Only the editor's own
// worker is needed, since no language service (TypeScript, JSON, CSS, HTML) is
// bundled - syntax highlighting comes from the language definitions above.
globalThis.MonacoEnvironment = {
  getWorker: () => new Worker(new URL("./monaco.worker.ts", import.meta.url), { type: "module" }),
};

// Monaco themes take hex colors, not CSS variables. The default theme's
// background is transparent so the container's Tailwind classes show through,
// and the rest follows the app's neutral dark palette.
monaco.editor.defineTheme("devstash-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#00000000",
    "editor.lineHighlightBackground": "#ffffff0a",
    "editor.lineHighlightBorder": "#00000000",
    "editorLineNumber.foreground": "#525252",
    "editorLineNumber.activeForeground": "#a3a3a3",
    "editorWidget.background": "#171717",
    "editorWidget.border": "#ffffff1a",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff33",
    "scrollbarSlider.activeBackground": "#ffffff47",
  },
});

// The other two paint their own background, so the editor looks the same
// wherever it sits; the box around it clips the corners.
monaco.editor.defineTheme("monokai", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "f8f8f2" },
    { token: "comment", foreground: "75715e", fontStyle: "italic" },
    { token: "string", foreground: "e6db74" },
    { token: "string.escape", foreground: "ae81ff" },
    { token: "number", foreground: "ae81ff" },
    { token: "constant", foreground: "ae81ff" },
    { token: "keyword", foreground: "f92672" },
    { token: "operator", foreground: "f92672" },
    { token: "delimiter", foreground: "f8f8f2" },
    { token: "type", foreground: "66d9ef", fontStyle: "italic" },
    { token: "tag", foreground: "f92672" },
    { token: "attribute.name", foreground: "a6e22e" },
    { token: "attribute.value", foreground: "e6db74" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "regexp", foreground: "fd971f" },
  ],
  colors: {
    "editor.background": "#272822",
    "editor.foreground": "#f8f8f2",
    "editor.lineHighlightBackground": "#3e3d32",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#49483e",
    "editorCursor.foreground": "#f8f8f0",
    "editorLineNumber.foreground": "#90908a",
    "editorLineNumber.activeForeground": "#c2c2bf",
    "editorWidget.background": "#1e1f1c",
    "editorWidget.border": "#ffffff1a",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff33",
    "scrollbarSlider.activeBackground": "#ffffff47",
  },
});

monaco.editor.defineTheme("github-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "", foreground: "e6edf3" },
    { token: "comment", foreground: "8b949e" },
    { token: "string", foreground: "a5d6ff" },
    { token: "string.escape", foreground: "79c0ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "constant", foreground: "79c0ff" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "operator", foreground: "ff7b72" },
    { token: "delimiter", foreground: "e6edf3" },
    { token: "type", foreground: "ffa657" },
    { token: "tag", foreground: "7ee787" },
    { token: "attribute.name", foreground: "79c0ff" },
    { token: "attribute.value", foreground: "a5d6ff" },
    { token: "variable", foreground: "ffa657" },
    { token: "regexp", foreground: "a5d6ff" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#e6edf3",
    "editor.lineHighlightBackground": "#161b22",
    "editor.lineHighlightBorder": "#00000000",
    "editor.selectionBackground": "#264f78",
    "editorCursor.foreground": "#e6edf3",
    "editorLineNumber.foreground": "#6e7681",
    "editorLineNumber.activeForeground": "#e6edf3",
    "editorWidget.background": "#161b22",
    "editorWidget.border": "#ffffff1a",
    "scrollbar.shadow": "#00000000",
    "scrollbarSlider.background": "#ffffff1f",
    "scrollbarSlider.hoverBackground": "#ffffff33",
    "scrollbarSlider.activeBackground": "#ffffff47",
  },
});

/** The Monaco theme for each preference. "vs-dark" is the app's own transparent variant. */
const MONACO_THEMES: Record<EditorTheme, string> = {
  "vs-dark": "devstash-dark",
  monokai: "monokai",
  "github-dark": "github-dark",
};

const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: "var(--font-mono)",
  padding: { top: CODE_EDITOR_PADDING, bottom: CODE_EDITOR_PADDING },
  lineNumbersMinChars: 3,
  folding: false,
  glyphMargin: false,
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollBeyondLastLine: false,
  stickyScroll: { enabled: false },
  scrollbar: {
    verticalScrollbarSize: 10,
    verticalSliderSize: 6,
    horizontalScrollbarSize: 10,
    horizontalSliderSize: 6,
    useShadows: false,
    // Lets the wheel scroll the drawer or dialog once the editor can't scroll further.
    alwaysConsumeMouseWheel: false,
  },
  // Its menu renders outside the drawer and dialog, which treat a click on it
  // as a click outside and close.
  contextmenu: false,
  // With no language services the only suggestions would be words already in
  // the snippet, so the popup is noise.
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  wordBasedSuggestions: "off",
};

const READ_ONLY_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  readOnly: true,
  // Keeps the on-screen keyboard closed on touch devices.
  domReadOnly: true,
  // Tab moves focus on, as there is nothing to indent.
  tabFocusMode: true,
  renderLineHighlight: "none",
};

interface MonacoEditorProps {
  value: string;
  language: string | null | undefined;
  readOnly: boolean;
  onChange?: (value: string) => void;
  ariaLabel: string;
  /** The editor never shrinks below this height, in px. */
  minHeight: number;
}

/**
 * The Monaco editor itself, sized to its content between `minHeight` and the
 * max height. Loaded on demand by `CodeEditor`, never on the server.
 */
export function MonacoEditor({
  value,
  language,
  readOnly,
  onChange,
  ariaLabel,
  minHeight,
}: MonacoEditorProps) {
  const { fontSize, tabSize, wordWrap, minimap, theme } = useEditorPreferences();
  const lineHeight = getEditorLineHeight(fontSize);
  const [height, setHeight] = useState(() => estimateEditorHeight(value, minHeight, lineHeight));
  // A new object would make the wrapper re-apply every option on each keystroke.
  const options = useMemo(
    () => ({
      ...BASE_OPTIONS,
      ...(readOnly && READ_ONLY_OPTIONS),
      ariaLabel,
      fontSize,
      lineHeight,
      tabSize,
      // The chosen tab size applies as is, instead of Monaco guessing from the content.
      detectIndentation: false,
      wordWrap: wordWrap ? ("on" as const) : ("off" as const),
      minimap: { enabled: minimap },
    }),
    [readOnly, ariaLabel, fontSize, lineHeight, tabSize, wordWrap, minimap],
  );

  const handleMount: OnMount = (editor) => {
    const fit = () => setHeight(clampEditorHeight(editor.getContentHeight(), minHeight));

    editor.onDidContentSizeChange(fit);
    fit();
  };

  const handleChange: OnChange = (next) => onChange?.(next ?? "");

  return (
    <Editor
      height={height}
      value={value}
      language={toMonacoLanguage(language)}
      theme={MONACO_THEMES[theme]}
      options={options}
      onMount={handleMount}
      onChange={handleChange}
      loading={null}
    />
  );
}
