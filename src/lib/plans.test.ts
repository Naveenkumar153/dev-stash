import { describe, expect, it } from "vitest";

import {
  BILLING_SETTINGS_PATH,
  FREE_PLAN_FEATURES,
  getProPrice,
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

describe("getProPrice", () => {
  it("shows $8 billed monthly", () => {
    expect(getProPrice("monthly")).toEqual({ amount: "$8", billed: "billed monthly" });
  });

  it("shows the yearly price per month and the yearly total", () => {
    expect(getProPrice("yearly")).toEqual({ amount: "$6", billed: "billed $72/year" });
  });
});

describe("FREE_PLAN_FEATURES", () => {
  it("states the Free limits from the plan constants", () => {
    expect(FREE_PLAN_FEATURES.slice(0, 2).map((feature) => feature.label)).toEqual([
      "50 items",
      "3 collections",
    ]);
  });
});
