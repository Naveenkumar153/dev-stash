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

/** A byte count -> "512 B", "12.5 KB" or "3 MB" (1 KB = 1024 bytes). */
export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  // Rounded before choosing the unit, so 1,048,575 bytes reads "1 MB", not "1024 KB".
  const kb = Number((bytes / 1024).toFixed(1));
  if (kb < 1024) {
    return `${kb} KB`;
  }

  return `${Number((bytes / 1024 / 1024).toFixed(1))} MB`;
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
