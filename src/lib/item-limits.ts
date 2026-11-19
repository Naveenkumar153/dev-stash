/**
 * Longest values an item's fields accept. Enforced by the item schemas, and
 * given to the form inputs as `maxLength`. Zod-free, so the forms can import it
 * without pulling Zod into the browser bundle. Generous for real use while
 * keeping one item from carrying megabytes onto every card and list.
 */
export const ITEM_LIMITS = {
  title: 200,
  description: 2000,
  /** Code and notes run long, so content gets far more than the rest. */
  content: 100_000,
  language: 50,
  url: 2048,
  tag: 50,
  tagCount: 20,
} as const;
