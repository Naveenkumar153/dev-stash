/**
 * DevStash's plans: the Free tier's caps and Pro's prices, per
 * `context/project-overview.md` §6. Zod-free and server-free, so the homepage's
 * client islands, `action-result.ts` and the server all read one copy.
 */

/**
 * Bytes of uploaded files one account can store in R2. Uploads are Pro-only,
 * so this is Pro's storage allowance.
 */
export const STORAGE_QUOTA_BYTES = 1024 ** 3;

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

function formatDollars(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Pro's per-month amount and billing note for a billing interval. */
export function getProPrice(interval: BillingInterval): { amount: string; billed: string } {
  if (interval === "yearly") {
    return {
      amount: formatDollars(PRO_PRICES.yearly / 12),
      billed: `billed ${formatDollars(PRO_PRICES.yearly)}/year`,
    };
  }
  return { amount: formatDollars(PRO_PRICES.monthly), billed: "billed monthly" };
}

/** A line on a plan card's checklist. */
export interface PlanFeature {
  label: string;
  included: boolean;
}

/** What each plan's card lists, on the homepage's pricing section and /upgrade. */
export const FREE_PLAN_FEATURES: readonly PlanFeature[] = [
  { label: `${FREE_ITEM_LIMIT} items`, included: true },
  { label: `${FREE_COLLECTION_LIMIT} collections`, included: true },
  { label: "Snippets, Prompts, Commands, Notes, Links", included: true },
  { label: "Basic search", included: true },
  { label: "File & image uploads", included: false },
  { label: "AI features", included: false },
];

export const PRO_PLAN_FEATURES: readonly PlanFeature[] = [
  { label: "Unlimited items", included: true },
  { label: "Unlimited collections", included: true },
  { label: "All item types including Files & Images", included: true },
  { label: "AI auto-tagging & summaries", included: true },
  { label: 'AI "Explain This Code"', included: true },
  { label: "AI prompt optimizer", included: true },
  { label: "Data export (JSON/ZIP)", included: true },
];

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

/** While a finished Checkout hasn't reached the account yet, /settings re-checks this often. */
export const CHECKOUT_REFRESH_INTERVAL_MS = 3000;
/** About half a minute of re-checks before leaving it to the user. */
export const CHECKOUT_REFRESH_ATTEMPTS = 10;
