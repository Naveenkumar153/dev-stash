import type Stripe from "stripe";

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
