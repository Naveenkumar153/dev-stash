import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getClientIp,
  getRateLimitMessage,
  getRetryAfterSeconds,
  rateLimit,
} from "@/lib/rate-limit";

const NOW = new Date("2026-01-15T12:00:00Z").getTime();

describe("getClientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const headers = new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1" });

    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
  });

  it("returns 'unknown' when neither header is set", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});

describe("retry timing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rounds the wait up to whole seconds", () => {
    expect(getRetryAfterSeconds(NOW + 1_500)).toBe(2);
  });

  it("never tells a client to retry in less than a second", () => {
    expect(getRetryAfterSeconds(NOW - 5_000)).toBe(1);
  });

  it("words the message in whole minutes", () => {
    expect(getRateLimitMessage(NOW + 30_000)).toBe(
      "Too many attempts. Please try again in 1 minute.",
    );
    expect(getRateLimitMessage(NOW + 14 * 60_000 + 1_000)).toBe(
      "Too many attempts. Please try again in 15 minutes.",
    );
  });
});

describe("rateLimit", () => {
  it("fails open when Upstash isn't configured", async () => {
    // vitest.setup.ts clears the Upstash variables, so no request is made.
    await expect(rateLimit("signIn", "203.0.113.7:ada@example.com")).resolves.toMatchObject({
      success: true,
    });
  });
});
