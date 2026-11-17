import { describe, expect, it } from "vitest";

import {
  formatPreviewCount,
  getFooterColumns,
  getProPrice,
  getStartAction,
  getYearlySavingsPercent,
  PREVIEW_CARDS,
  PREVIEW_QUERY,
  previewCardMatches,
} from "@/lib/homepage";

describe("getStartAction", () => {
  it("sends a signed-out visitor to registration under the button's own label", () => {
    expect(getStartAction(false, "Get Started Free")).toEqual({
      label: "Get Started Free",
      href: "/register",
    });
  });

  it("sends a signed-in visitor to the dashboard whatever the label", () => {
    expect(getStartAction(true, "Upgrade to Pro")).toEqual({
      label: "Go to Dashboard",
      href: "/dashboard",
    });
  });
});

describe("getFooterColumns", () => {
  it("links the section anchors under Product", () => {
    const [product] = getFooterColumns(false);
    expect(product).toEqual({
      title: "Product",
      links: [
        { label: "Features", href: "/#features" },
        { label: "Pricing", href: "/#pricing" },
      ],
    });
  });

  it("offers sign in and registration when signed out", () => {
    const account = getFooterColumns(false)[1];
    expect(account.links.map((link) => link.href)).toEqual(["/sign-in", "/register"]);
  });

  it("offers the signed-in pages when signed in", () => {
    const account = getFooterColumns(true)[1];
    expect(account.links.map((link) => link.href)).toEqual(["/dashboard", "/profile", "/settings"]);
  });
});

describe("getProPrice", () => {
  it("shows $8 billed monthly", () => {
    expect(getProPrice("monthly")).toEqual({ amount: "$8", billed: "billed monthly" });
  });

  it("shows the yearly price per month and the yearly total", () => {
    expect(getProPrice("yearly")).toEqual({ amount: "$6", billed: "billed $72/year" });
  });

  it("works out the yearly saving", () => {
    expect(getYearlySavingsPercent()).toBe(25);
  });
});

describe("previewCardMatches", () => {
  const [snippet, prompt] = PREVIEW_CARDS;

  it("matches every card on a blank query", () => {
    expect(PREVIEW_CARDS.every((card) => previewCardMatches(card, "  "))).toBe(true);
  });

  it("matches the title, detail and tags, ignoring case", () => {
    expect(previewCardMatches(snippet, "DEBOUNCE")).toBe(true);
    expect(previewCardMatches(snippet, "q, 300")).toBe(true);
    expect(previewCardMatches(snippet, "hooks")).toBe(true);
    expect(previewCardMatches(prompt, "debounce")).toBe(false);
  });

  it("narrows the demo's query to exactly one card", () => {
    const matching = PREVIEW_CARDS.filter((card) => previewCardMatches(card, PREVIEW_QUERY));
    expect(matching.map((card) => card.title)).toEqual(["useDebounce hook"]);
  });
});

describe("formatPreviewCount", () => {
  it("counts items while the search is blank", () => {
    expect(formatPreviewCount("", 6, 6)).toBe("6 items");
  });

  it("counts results while searching, singular and plural", () => {
    expect(formatPreviewCount("deb", 1, 6)).toBe("1 result");
    expect(formatPreviewCount("d", 2, 6)).toBe("2 results");
    expect(formatPreviewCount("zzz", 0, 6)).toBe("0 results");
  });
});
