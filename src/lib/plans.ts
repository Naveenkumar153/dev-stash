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
