import Stripe from "stripe";

import type { BillingInterval } from "@/lib/plans";

let client: Stripe | undefined;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/**
 * The Stripe client, created on first use like the R2 and Resend clients. No
 * `apiVersion` is passed: stripe-node pins the API version it was generated
 * for, which keeps its types and the responses in agreement. Upgrading the SDK
 * is the upgrade path; the webhook endpoint's API version should match it.
 */
export function getStripe(): Stripe {
  client ??= new Stripe(getEnv("STRIPE_SECRET_KEY"), {
    appInfo: { name: "DevStash" },
    maxNetworkRetries: 2,
  });
  return client;
}

/** The signing secret webhook payloads are verified against. */
export function getWebhookSecret(): string {
  return getEnv("STRIPE_WEBHOOK_SECRET");
}

/** The Stripe price for Pro at a billing interval. */
export function getPriceId(interval: BillingInterval): string {
  return getEnv(interval === "yearly" ? "STRIPE_PRICE_ID_YEARLY" : "STRIPE_PRICE_ID_MONTHLY");
}

/**
 * Statuses that grant Pro. `past_due` keeps access while Stripe retries the
 * card; once retries run out the subscription becomes `canceled` or `unpaid`.
 */
const PRO_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
  "past_due",
]);

export function isProStatus(status: Stripe.Subscription.Status): boolean {
  return PRO_STATUSES.has(status);
}

/** A customer or subscription field may be an id or an expanded object. */
export function toId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}
