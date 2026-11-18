import type Stripe from "stripe";

import { checkoutSessionIdSchema } from "@/lib/billing-schemas";
import { prisma } from "@/lib/prisma";
import { getStripe, isProStatus, toId } from "@/lib/stripe";

/**
 * The only module that writes `isPro`, `stripeCustomerId` and
 * `stripeSubscriptionId`. Webhooks and the post-checkout sync both go through
 * `syncSubscription()`, so every write starts from Stripe's current state.
 */

export interface BillingStatus {
  isPro: boolean;
  /** Has a Stripe customer, so the Customer Portal has something to show. */
  hasCustomer: boolean;
}

export async function getBillingStatus(userId: string): Promise<BillingStatus | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true, stripeCustomerId: true },
  });
  return user && { isPro: user.isPro, hasCustomer: user.stripeCustomerId !== null };
}

/**
 * The user's Stripe customer id, creating the customer on first checkout. The
 * idempotency key makes two concurrent first checkouts share one customer at
 * Stripe, and the conditional update keeps whichever id was saved first: the
 * loser re-reads the winner's.
 */
export async function getOrCreateCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userId } },
    { idempotencyKey: `customer-${userId}` },
  );

  const { count } = await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (count === 1) {
    return customer.id;
  }

  const winner = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  if (!winner.stripeCustomerId) {
    throw new Error(`Couldn't save a Stripe customer for user ${userId}`);
  }
  return winner.stripeCustomerId;
}

/**
 * Writes a subscription's state onto the user who owns its customer. Callers
 * pass a freshly retrieved subscription, so events that arrive twice or out of
 * order converge on Stripe's state. `stripeCustomerId` is never cleared, so a
 * returning subscriber reuses their customer, payment methods and invoices.
 */
export async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = toId(subscription.customer);
  if (!customerId) {
    return;
  }

  if (isProStatus(subscription.status)) {
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { isPro: true, stripeSubscriptionId: subscription.id },
    });
    return;
  }

  // Only the user's current subscription can revoke Pro, so a late event for
  // an older, replaced subscription can't undo a newer one.
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId, stripeSubscriptionId: subscription.id },
    data: { isPro: false, stripeSubscriptionId: null },
  });
}

/** Re-reads a subscription from Stripe and applies it. */
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await applySubscription(subscription);
}

/**
 * Applies a finished Checkout as soon as Stripe redirects back, so `/settings`
 * shows Pro even before the webhook lands. The session is re-read from Stripe
 * and must belong to `userId`, so a forged or shared `session_id` changes
 * nothing. Failures are logged rather than thrown: the webhook still applies
 * the subscription, and the page shows a "finishing up" notice meanwhile.
 */
export async function syncCheckoutForUser(userId: string, sessionId: string): Promise<void> {
  const parsed = checkoutSessionIdSchema.safeParse(sessionId);
  if (!parsed.success) {
    return;
  }

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data);
    const subscriptionId = toId(session.subscription);
    if (session.client_reference_id !== userId || !subscriptionId) {
      return;
    }

    await syncSubscription(subscriptionId);
  } catch (error) {
    console.error("Syncing checkout session failed", error);
  }
}

/** Statuses after which a subscription can't bill again. */
const ENDED_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "canceled",
  "incomplete_expired",
]);

/**
 * Cancels a subscription immediately, before its account is deleted. Stripe
 * refuses to cancel one that has already ended, which happens when a missed
 * webhook left its id stored; that counts as done rather than blocking the
 * delete. Any other failure throws.
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  const stripe = getStripe();
  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    const current = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
    if (!current || !ENDED_STATUSES.has(current.status)) {
      throw error;
    }
  }
}
