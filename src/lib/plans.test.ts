import { describe, expect, it } from "vitest";

import { getUpgradePath, getYearlySavingsPercent, UPGRADE_PATH } from "@/lib/plans";

describe("getYearlySavingsPercent", () => {
  it("works out the yearly saving over twelve monthly payments", () => {
    expect(getYearlySavingsPercent()).toBe(25);
  });
});

describe("upgrade paths", () => {
  it("points at the Billing card on settings", () => {
    expect(UPGRADE_PATH).toBe("/settings#billing");
  });

  it("carries a picked interval as ?plan=", () => {
    expect(getUpgradePath("yearly")).toBe("/settings?plan=yearly#billing");
    expect(getUpgradePath("monthly")).toBe("/settings?plan=monthly#billing");
  });
});
