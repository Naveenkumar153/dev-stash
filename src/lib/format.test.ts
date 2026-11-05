import { describe, expect, it } from "vitest";

import { formatLongDate, formatShortDate } from "@/lib/format";

// 23:30 UTC is already the next day east of UTC and still the same day west of
// it, so these only pass if the formatting ignores the machine's time zone.
const LATE_UTC = new Date("2026-01-15T23:30:00Z");
const EARLY_UTC = new Date("2026-01-15T00:30:00Z");

describe("formatShortDate", () => {
  it("formats in UTC", () => {
    expect(formatShortDate(LATE_UTC)).toBe("Jan 15");
    expect(formatShortDate(EARLY_UTC)).toBe("Jan 15");
  });
});

describe("formatLongDate", () => {
  it("formats in UTC", () => {
    expect(formatLongDate(LATE_UTC)).toBe("January 15, 2026");
    expect(formatLongDate(EARLY_UTC)).toBe("January 15, 2026");
  });
});
