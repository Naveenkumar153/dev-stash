/**
 * The edit form's comma-separated tags as names: trimmed, blanks dropped and
 * each kept once, in the order typed. "react, hooks, , react" -> ["react", "hooks"]
 *
 * Kept out of `item-schemas.ts` so the forms that call it don't pull Zod into
 * the browser bundle.
 */
export function parseTagInput(input: string): string[] {
  const names = input
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return [...new Set(names)];
}

/**
 * The comma-separated tags with `tag` appended, as an accepted AI suggestion
 * joins them. Unchanged when the input already has it, ignoring case.
 * "react, hooks" + "state" -> "react, hooks, state"
 */
export function addTagToInput(input: string, tag: string): string {
  const tags = parseTagInput(input);
  if (tags.some((name) => name.toLowerCase() === tag.toLowerCase())) {
    return input;
  }

  return [...tags, tag].join(", ");
}
