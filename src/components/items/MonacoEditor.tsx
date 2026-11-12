"use client";

import Editor, { loader, type OnChange, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor";
import "monaco-editor/features/register.all";
import "monaco-editor/languages/definitions/register.all";
import { useMemo, useState } from "react";

import {
  CODE_EDITOR_LINE_HEIGHT,
  CODE_EDITOR_PADDING,
  clampEditorHeight,
  estimateEditorHeight,
  toMonacoLanguage,
} from "@/lib/code-editor";

const THEME = "devstash-dark";

// Use this bundled copy of Monaco instead of the wrapper's default, which
// downloads one from a CDN at runtime.
loader.config({ monaco });

// Monaco runs its text computations in a web worker. Only the editor's own
// worker is needed, since no language service (TypeScript, JSON, CSS, HTML) is
// bundled - syntax highlighting comes from the language definitions above.
globalThis.MonacoEnvironment = {
  getWorker: () => new Worker(new URL("./monaco.worker.ts", import.meta.url), { type: "module" }),
};

// Monaco themes take hex colors, not CSS variables. The background is
// transparent so the container's Tailwind classes show through, and the rest
// follows the app's neutral dark palette.
monaco.editor.defineTheme(THEME, {
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

const BASE_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  lineHeight: CODE_EDITOR_LINE_HEIGHT,
  padding: { top: CODE_EDITOR_PADDING, bottom: CODE_EDITOR_PADDING },
  lineNumbersMinChars: 3,
  folding: false,
  glyphMargin: false,
  minimap: { enabled: false },
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
  const [height, setHeight] = useState(() => estimateEditorHeight(value, minHeight));
  // A new object would make the wrapper re-apply every option on each keystroke.
  const options = useMemo(
    () => ({ ...BASE_OPTIONS, ...(readOnly && READ_ONLY_OPTIONS), ariaLabel }),
    [readOnly, ariaLabel],
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
      theme={THEME}
      options={options}
      onMount={handleMount}
      onChange={handleChange}
      loading={null}
    />
  );
}
