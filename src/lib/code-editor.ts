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
