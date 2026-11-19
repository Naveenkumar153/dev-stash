/**
 * DevStash's plans: the Free tier's caps and Pro's prices, per
 * `context/project-overview.md` §6. Zod-free and server-free, so the homepage's
 * client islands, `action-result.ts` and the server all read one copy.
 */

/** Free-tier caps. Pro has none. */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/** Pro's list prices in dollars. Stripe's prices must match these. */
export const PRO_PRICES = { monthly: 8, yearly: 72 } as const satisfies Record<
  BillingInterval,
  number
>;

/** How much yearly billing saves over twelve monthly payments, in whole percent. */
export function getYearlySavingsPercent(): number {
  return Math.round((1 - PRO_PRICES.yearly / (PRO_PRICES.monthly * 12)) * 100);
}

/** The upgrade page, where a Free user picks monthly or yearly and starts Checkout. */
export const UPGRADE_PATH = "/upgrade";

/** The Billing card on /settings, where a Pro user manages their subscription. */
export const BILLING_SETTINGS_PATH = "/settings#billing";

/**
 * The upgrade page with a billing interval picked, e.g. from the homepage's
 * Pro card: `/upgrade?plan=yearly`.
 */
export function getUpgradePath(interval: BillingInterval): string {
  return `${UPGRADE_PATH}?plan=${interval}`;
}

/** A `?plan=` value as an interval: yearly only when asked for, else monthly. */
export function parseBillingInterval(value: unknown): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}
