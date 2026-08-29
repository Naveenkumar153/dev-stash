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
