import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getClientIp,
  getRateLimitError,
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

describe("getRateLimitError", () => {
  it("returns null when Upstash isn't configured, failing open", async () => {
    await expect(getRateLimitError("ai", "user-1")).resolves.toBeNull();
  });

  describe("with Upstash configured", () => {
    const limit = vi.fn();

    /**
     * The Redis client is cached per module, so each case loads a fresh copy
     * with Upstash's two clients stubbed.
     */
    async function loadRateLimit() {
      vi.resetModules();
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
      vi.doMock("@upstash/redis", () => ({ Redis: class {} }));
      vi.doMock("@upstash/ratelimit", () => ({
        Ratelimit: Object.assign(
          class {
            limit = limit;
          },
          { slidingWindow: vi.fn() },
        ),
      }));
      return import("@/lib/rate-limit");
    }

    afterEach(() => {
      vi.doUnmock("@upstash/redis");
      vi.doUnmock("@upstash/ratelimit");
      vi.useRealTimers();
    });

    it("returns null while the key is under its limit", async () => {
      limit.mockResolvedValue({ success: true, remaining: 4, reset: NOW });
      const { getRateLimitError: check } = await loadRateLimit();

      await expect(check("changePassword", "user-1")).resolves.toBeNull();
      expect(limit).toHaveBeenCalledWith("user-1");
    });

    it("returns the try-again message once the limit is reached", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
      limit.mockResolvedValue({ success: false, remaining: 0, reset: NOW + 10 * 60 * 1000 });
      const { getRateLimitError: check } = await loadRateLimit();

      await expect(check("ai", "user-1")).resolves.toBe(
        "Too many attempts. Please try again in 10 minutes.",
      );
    });

    it("returns null when Upstash fails, logging it", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      limit.mockRejectedValue(new Error("connection reset"));
      const { getRateLimitError: check } = await loadRateLimit();

      await expect(check("ai", "user-1")).resolves.toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });
});
