/**
 * A timestamp -> "Jan 15". Formatted in UTC so the date never shifts by a day
 * between the server and the browser.
 */
export function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A timestamp -> "January 15, 2026", in UTC like formatShortDate(). */
export function formatLongDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
