import { describe, expect, it } from "vitest";

import {
  BILLING_SETTINGS_PATH,
  getUpgradePath,
  getYearlySavingsPercent,
  parseBillingInterval,
  UPGRADE_PATH,
} from "@/lib/plans";

describe("getYearlySavingsPercent", () => {
  it("works out the yearly saving over twelve monthly payments", () => {
    expect(getYearlySavingsPercent()).toBe(25);
  });
});

describe("upgrade paths", () => {
  it("points at the upgrade page", () => {
    expect(UPGRADE_PATH).toBe("/upgrade");
  });

  it("carries a picked interval as ?plan=", () => {
    expect(getUpgradePath("yearly")).toBe("/upgrade?plan=yearly");
    expect(getUpgradePath("monthly")).toBe("/upgrade?plan=monthly");
  });

  it("sends Pro users to the Billing card on settings", () => {
    expect(BILLING_SETTINGS_PATH).toBe("/settings#billing");
  });
});

describe("parseBillingInterval", () => {
  it("reads yearly", () => {
    expect(parseBillingInterval("yearly")).toBe("yearly");
  });

  it.each([undefined, null, "", "monthly", "Yearly", " yearly", "annual", ["yearly"], 12])(
    "falls back to monthly for %j",
    (value) => {
      expect(parseBillingInterval(value)).toBe("monthly");
    },
  );
});
