// Dashboard helpers still backed by mock data. Collections and stats now come
// from the database — see src/lib/db.

import { items, type Item } from "@/lib/mock-data";

const RECENT_ITEM_LIMIT = 10;

/** Newest first. Ids are unique, so a plain string compare is enough. */
function byNewest(a: { createdAt: string }, b: { createdAt: string }) {
  return b.createdAt.localeCompare(a.createdAt);
}

/** Items the user pinned to the top, newest first. */
export function getPinnedItems(): Item[] {
  return items.filter((item) => item.isPinned).sort(byNewest);
}

/** The latest items, newest first. */
export function getRecentItems(limit = RECENT_ITEM_LIMIT): Item[] {
  return [...items].sort(byNewest).slice(0, limit);
}

/**
 * "2026-01-15" -> "Jan 15". Formatted in UTC so the date never shifts by a day
 * between the server and the browser.
 */
export function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
