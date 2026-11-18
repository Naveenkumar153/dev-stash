import { describe, expect, it, vi } from "vitest";

import { getPriceId, getStripe, getWebhookSecret, isProStatus, toId } from "@/lib/stripe";

const constructed = vi.hoisted(() => vi.fn());

// No real client: the stub records what it was built with.
vi.mock("stripe", () => ({
  default: class {
    constructor(key: string, config: unknown) {
      constructed(key, config);
    }
  },
}));

describe("getStripe", () => {
  it("throws when the secret key is unset", () => {
    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not set");
  });

  it("builds one client with the SDK's pinned API version", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");

    const client = getStripe();
    expect(getStripe()).toBe(client);
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(constructed).toHaveBeenCalledWith("sk_test_123", {
      appInfo: { name: "DevStash" },
      maxNetworkRetries: 2,
    });
  });
});

describe("getWebhookSecret", () => {
  it("reads the signing secret", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    expect(getWebhookSecret()).toBe("whsec_123");
  });

  it("throws when unset", () => {
    expect(() => getWebhookSecret()).toThrow("STRIPE_WEBHOOK_SECRET is not set");
  });
});

describe("getPriceId", () => {
  it("reads each interval's price", () => {
    vi.stubEnv("STRIPE_PRICE_ID_MONTHLY", "price_month");
    vi.stubEnv("STRIPE_PRICE_ID_YEARLY", "price_year");

    expect(getPriceId("monthly")).toBe("price_month");
    expect(getPriceId("yearly")).toBe("price_year");
  });

  it("throws when the interval's price is unset", () => {
    expect(() => getPriceId("monthly")).toThrow("STRIPE_PRICE_ID_MONTHLY is not set");
    expect(() => getPriceId("yearly")).toThrow("STRIPE_PRICE_ID_YEARLY is not set");
  });
});

describe("isProStatus", () => {
  it.each(["active", "trialing", "past_due"])("grants Pro for %s", (status) => {
    expect(isProStatus(status)).toBe(true);
  });

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "something_new"])(
    "doesn't grant Pro for %s",
    (status) => {
      expect(isProStatus(status)).toBe(false);
    },
  );
});

describe("toId", () => {
  it("returns a string id as is", () => {
    expect(toId("cus_123")).toBe("cus_123");
  });

  it("reads the id of an expanded object", () => {
    expect(toId({ id: "cus_123" })).toBe("cus_123");
  });

  it("is null for null", () => {
    expect(toId(null)).toBeNull();
  });
});
