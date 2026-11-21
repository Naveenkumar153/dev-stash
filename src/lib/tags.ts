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

/** What accepting a suggested tag does to the comma-separated input. */
export type AcceptTagResult =
  | { status: "added"; tags: string }
  /** The input already has the tag, ignoring case, so nothing changes. */
  | { status: "present"; tags: string }
  /** The input already has `maxTags`, so the new tag doesn't fit. */
  | { status: "full" };

/**
 * Accepts an AI-suggested tag into the comma-separated input, within the
 * item's tag limit. A tag already there changes nothing, so only a new one can
 * hit the limit.
 */
export function acceptSuggestedTag(input: string, tag: string, maxTags: number): AcceptTagResult {
  const tags = addTagToInput(input, tag);
  if (tags === input) {
    return { status: "present", tags };
  }
  if (parseTagInput(input).length >= maxTags) {
    return { status: "full" };
  }
  return { status: "added", tags };
}
