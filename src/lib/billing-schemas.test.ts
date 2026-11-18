import { describe, expect, it } from "vitest";

import { billingIntervalSchema, checkoutSessionIdSchema } from "@/lib/billing-schemas";

describe("billingIntervalSchema", () => {
  it.each(["monthly", "yearly"])("accepts %s", (value) => {
    expect(billingIntervalSchema.safeParse(value).success).toBe(true);
  });

  it.each(["weekly", "Monthly", "", null, 8])("rejects %j", (value) => {
    expect(billingIntervalSchema.safeParse(value).success).toBe(false);
  });
});

describe("checkoutSessionIdSchema", () => {
  it.each(["cs_test_a1B2c3", "cs_live_a1B2c3"])("accepts %s", (value) => {
    expect(checkoutSessionIdSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    "cs_",
    "cs_test_",
    "cs_other_a1B2",
    "pi_test_a1B2",
    "{CHECKOUT_SESSION_ID}",
    "cs_test_a1B2/../x",
    " cs_test_a1B2",
    "",
  ])("rejects %j", (value) => {
    expect(checkoutSessionIdSchema.safeParse(value).success).toBe(false);
  });
});
