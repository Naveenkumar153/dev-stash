import { defaultFilter } from "cmdk";

import { getItemTypeLabel } from "@/lib/item-types";
import type { SearchCollection, SearchData, SearchItem } from "@/types/search";

/**
 * Rows shown per group. The palette is for jumping to something by name, so a
 * longer list only costs render time; typing more narrows it.
 */
export const SEARCH_RESULT_LIMIT = 50;

/**
 * The lowest fuzzy score that counts. cmdk's scorer multiplies by 0.9 for each
 * jump to the start of a word but by 0.17 for each jump into the middle of
 * one, so its scores fall into two groups: letters that continue a run or
 * start a word ("deploy mig", "rp" for React Patterns) score about 0.5 and up,
 * while any mid-word jump drops a match to 0.17 or below ("test" spelled out
 * across "Typed conText ... Snippet"). Without a floor, every title holding
 * the letters in order matched.
 */
export const MIN_FUZZY_SCORE = 0.2;

/**
 * Score when each typed word starts a word of the title, camelCase humps
 * included ("debounce" in "useDebounce hook"), which the fuzzy scorer counts
 * as a mid-word jump. Ranked below a clean fuzzy match, above content.
 */
export const TITLE_WORD_MATCH_SCORE = 0.5;

/**
 * Score for a match found only in an item's content preview, when each typed
 * word starts a word there. Fuzzy matching over a few hundred characters of
 * content would match almost any short query somewhere, so content never
 * counts fuzzily.
 */
export const CONTENT_MATCH_SCORE = 0.2;

/** Fuzzy score of `query` against `text` (plus `aliases`), 0 below the floor. */
function fuzzyScore(text: string, query: string, aliases: string[] = []): number {
  const score = defaultFilter(text, query, aliases);

  return score >= MIN_FUZZY_SCORE ? score : 0;
}

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const LOWERCASE = /\p{Ll}/u;
const UPPERCASE = /\p{Lu}/u;

/**
 * Whether a word starts at `index`: at the start of the text, after anything
 * that isn't a letter or digit, or on a camelCase hump (lower then upper).
 */
function isWordStart(text: string, index: number): boolean {
  if (index === 0) {
    return true;
  }

  const previous = text[index - 1];

  return (
    !LETTER_OR_DIGIT.test(previous) ||
    (LOWERCASE.test(previous) && UPPERCASE.test(text[index]))
  );
}

/** Whether `word` (lowercase) begins a word somewhere in `text`, ignoring case. */
function startsAWord(text: string, word: string): boolean {
  for (let index = 0; index + word.length <= text.length; index += 1) {
    if (
      isWordStart(text, index) &&
      text.slice(index, index + word.length).toLowerCase() === word
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Whether every whitespace-separated word of `query` starts a word in `text`,
 * ignoring case: "test" matches "tests" and "testing" but not "latest".
 */
export function matchesEveryWord(text: string | null, query: string): boolean {
  if (!text) {
    return false;
  }

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);

  return words.length > 0 && words.every((word) => startsAWord(text, word));
}

/**
 * How well an item matches, the best of: fuzzy over its title and type label,
 * so "react snip" finds a React snippet; every word starting a word of the
 * title; every word starting a word of the content preview.
 */
export function scoreSearchItem(item: SearchItem, query: string): number {
  return Math.max(
    fuzzyScore(item.title, query, [getItemTypeLabel(item.typeName)]),
    matchesEveryWord(item.title, query) ? TITLE_WORD_MATCH_SCORE : 0,
    matchesEveryWord(item.preview, query) ? CONTENT_MATCH_SCORE : 0,
  );
}

/** How well a collection matches: fuzzy over its name, or every word starting a word of it. */
export function scoreSearchCollection(collection: SearchCollection, query: string): number {
  return Math.max(
    fuzzyScore(collection.name, query),
    matchesEveryWord(collection.name, query) ? TITLE_WORD_MATCH_SCORE : 0,
  );
}

/**
 * Entries scoring above zero, best first. Equal scores keep the incoming
 * order (newest first), since `sort` is stable.
 */
function rank<T>(entries: T[], query: string, score: (entry: T, query: string) => number): T[] {
  return entries
    .map((entry) => ({ entry, score: score(entry, query) }))
    .filter(({ score: value }) => value > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry)
    .slice(0, SEARCH_RESULT_LIMIT);
}

/**
 * The palette's results for `query`, each group ranked best first and capped
 * at `SEARCH_RESULT_LIMIT`. A blank query lists everything in the order loaded.
 */
export function searchPaletteData(data: SearchData, rawQuery: string): SearchData {
  const query = rawQuery.trim();

  if (!query) {
    return {
      items: data.items.slice(0, SEARCH_RESULT_LIMIT),
      collections: data.collections.slice(0, SEARCH_RESULT_LIMIT),
    };
  }

  return {
    items: rank(data.items, query, scoreSearchItem),
    collections: rank(data.collections, query, scoreSearchCollection),
  };
}
