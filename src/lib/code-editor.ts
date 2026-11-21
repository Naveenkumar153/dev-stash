import type { EditorFontSize } from "@/lib/editor-preferences";

/** Monaco's id for text with no syntax highlighting. */
export const PLAIN_TEXT_LANGUAGE = "plaintext";

/** The editor grows with its content up to this height, then scrolls. */
export const CODE_EDITOR_MAX_HEIGHT = 400;

/** Vertical padding, in px, shared by the editor options and its height estimate. */
export const CODE_EDITOR_PADDING = 12;

/** The line height at the editor's original 13px font, which the ratio below reproduces. */
export const CODE_EDITOR_LINE_HEIGHT = 20;

const LINE_HEIGHT_RATIO = CODE_EDITOR_LINE_HEIGHT / 13;

/** Line height in px for a font size: about 1.54x, so larger fonts don't clip or crowd. */
export function getEditorLineHeight(fontSize: number) {
  return Math.round(fontSize * LINE_HEIGHT_RATIO);
}

/**
 * Tailwind classes for text that follows the editor font size preference
 * outside Monaco (the markdown Write textarea), with the same line heights as
 * `getEditorLineHeight()`. Literal strings, so Tailwind finds them; `md:`
 * overrides the textarea's own `md:text-sm`.
 */
export const EDITOR_TEXT_CLASSES: Record<EditorFontSize, string> = {
  12: "text-[12px] leading-[18px] md:text-[12px]",
  13: "text-[13px] leading-[20px] md:text-[13px]",
  14: "text-[14px] leading-[22px] md:text-[14px]",
  16: "text-[16px] leading-[25px] md:text-[16px]",
  18: "text-[18px] leading-[28px] md:text-[18px]",
};

/**
 * Monaco language ids for common ways of writing a language in an item's
 * free-text `language` field. A Map rather than an object literal, so a value
 * like "constructor" can't match an inherited property.
 */
const LANGUAGE_ALIASES = new Map([
  ["bash", "shell"],
  ["sh", "shell"],
  ["zsh", "shell"],
  ["ts", "typescript"],
  ["tsx", "typescript"],
  ["js", "javascript"],
  ["jsx", "javascript"],
  ["mjs", "javascript"],
  ["cjs", "javascript"],
  // No JSON grammar is bundled, and JavaScript's highlights JSON well.
  ["json", "javascript"],
  ["jsonc", "javascript"],
  ["py", "python"],
  ["rb", "ruby"],
  ["rs", "rust"],
  ["golang", "go"],
  ["kt", "kotlin"],
  ["cs", "csharp"],
  ["c#", "csharp"],
  ["c++", "cpp"],
  ["yml", "yaml"],
  ["md", "markdown"],
  ["ps1", "powershell"],
  ["pwsh", "powershell"],
  ["docker", "dockerfile"],
  ["postgres", "pgsql"],
  ["postgresql", "pgsql"],
  ["htm", "html"],
  ["objc", "objective-c"],
  ["coffee", "coffeescript"],
  ["protobuf", "proto"],
  ["solidity", "sol"],
  ["terraform", "hcl"],
]);

/**
 * The Monaco language id for an item's language, e.g. "bash" -> "shell" and
 * "TypeScript" -> "typescript". Other names pass through lowercased, and
 * Monaco shows a language it doesn't know as plain text.
 */
export function toMonacoLanguage(language: string | null | undefined) {
  const name = language?.trim().toLowerCase();

  if (!name) {
    return PLAIN_TEXT_LANGUAGE;
  }

  return LANGUAGE_ALIASES.get(name) ?? name;
}

/** The label shown for an item with no language. */
export const PLAIN_TEXT_LABEL = "Plain text";

export interface CodeLanguage {
  /** What's stored in `Item.language`; `toMonacoLanguage()` maps it to Monaco's id. */
  value: string;
  label: string;
}

/**
 * The languages offered by the Language dropdown, by label. Each maps to a
 * grammar bundled through `languages/definitions/register.all`. "Plain text"
 * isn't listed: it stores no language.
 */
export const CODE_LANGUAGES: readonly CodeLanguage[] = [
  { value: "bash", label: "Bash" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "css", label: "CSS" },
  { value: "dockerfile", label: "Dockerfile" },
  { value: "go", label: "Go" },
  { value: "graphql", label: "GraphQL" },
  { value: "html", label: "HTML" },
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "json", label: "JSON" },
  { value: "kotlin", label: "Kotlin" },
  { value: "markdown", label: "Markdown" },
  { value: "php", label: "PHP" },
  { value: "powershell", label: "PowerShell" },
  { value: "python", label: "Python" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
  { value: "scss", label: "SCSS" },
  { value: "sql", label: "SQL" },
  { value: "swift", label: "Swift" },
  { value: "typescript", label: "TypeScript" },
  { value: "yaml", label: "YAML" },
];

/** The listed language a stored value names, ignoring case and surrounding spaces. */
export function findCodeLanguage(language: string | null | undefined) {
  const name = language?.trim().toLowerCase();

  return name ? CODE_LANGUAGES.find((option) => option.value === name) : undefined;
}

/**
 * How a stored language reads: its label when listed ("typescript" ->
 * "TypeScript"), otherwise the value as typed, or "Plain text" when blank.
 */
export function getLanguageLabel(language: string | null | undefined) {
  if (isPlainText(language)) {
    return PLAIN_TEXT_LABEL;
  }

  return findCodeLanguage(language)?.label ?? (language?.trim() || PLAIN_TEXT_LABEL);
}

/** Whether a stored language means no highlighting: blank, or Monaco's "plaintext" id. */
function isPlainText(language: string | null | undefined) {
  const name = language?.trim().toLowerCase();

  return !name || name === PLAIN_TEXT_LANGUAGE;
}

/**
 * The dropdown option a stored language selects: the listed value it names,
 * Monaco's "plaintext" id for plain text, otherwise the value as typed
 * (trimmed), which `getLanguageOptions()` lists as an extra option.
 */
export function toLanguageSelectValue(language: string | null | undefined) {
  if (isPlainText(language)) {
    return PLAIN_TEXT_LANGUAGE;
  }

  return findCodeLanguage(language)?.value ?? (language ?? "").trim();
}

/**
 * The dropdown's options for an item whose language is `current`: the listed
 * languages, plus `current` itself when it's a value typed before the list
 * existed, so editing the item doesn't drop it.
 */
export function getLanguageOptions(current: string | null | undefined): readonly CodeLanguage[] {
  if (isPlainText(current) || findCodeLanguage(current)) {
    return CODE_LANGUAGES;
  }

  const value = (current ?? "").trim();

  return [...CODE_LANGUAGES, { value, label: value }];
}

/** The editor's height for content this tall: at least `minHeight`, at most the max. */
export function clampEditorHeight(contentHeight: number, minHeight = 0) {
  return Math.min(CODE_EDITOR_MAX_HEIGHT, Math.max(minHeight, contentHeight));
}

/**
 * The editor's height for `value` before Monaco has measured it, from the line
 * count, so the box starts close to its final size.
 */
export function estimateEditorHeight(
  value: string,
  minHeight = 0,
  lineHeight = CODE_EDITOR_LINE_HEIGHT,
) {
  const lines = value.split("\n").length;

  return clampEditorHeight(lines * lineHeight + CODE_EDITOR_PADDING * 2, minHeight);
}
