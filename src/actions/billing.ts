"use server";

import {
  BILLING_PORTAL_FAILED,
  CHECKOUT_FAILED,
  SESSION_EXPIRED,
  actionFailure,
} from "@/lib/action-result";
import { getAppUrl } from "@/lib/app-url";
import { billingIntervalSchema } from "@/lib/billing-schemas";
import {
  findLiveSubscriptionId,
  getBillingStatus,
  getOrCreateCustomerId,
  syncSubscription,
} from "@/lib/db/billing";
import { UPGRADE_PATH } from "@/lib/plans";
import { getSessionUserId } from "@/lib/session";
import { getPriceId, getStripe } from "@/lib/stripe";
import type { BillingRedirectResult } from "@/types/billing";

/** Where Checkout's success and the Portal return to: the Billing card syncs there. */
function getSettingsUrl(): string {
  return `${getAppUrl()}/settings`;
}

const DEMO_BILLING_CLOSED = "The demo account is shared, so its billing can't be changed.";

/**
 * Starts a Stripe-hosted Checkout for Pro at the chosen interval and returns
 * its URL for the browser to open. A user who already has a live subscription
 * gets the Customer Portal instead, so a second click, a second tab or Back
 * from Checkout can't start a second subscription. That is asked of Stripe:
 * the stored `isPro` lags until the webhook or the post-checkout sync lands.
 */
export async function createCheckoutSession(interval: unknown): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  const parsed = billingIntervalSchema.safeParse(interval);
  if (!parsed.success) {
    return actionFailure("Choose monthly or yearly billing.");
  }

  try {
    const status = await getBillingStatus(userId);
    if (status?.isDemo) {
      return actionFailure(DEMO_BILLING_CLOSED);
    }
    if (status?.isPro) {
      return createPortalSession();
    }

    const customer = await getOrCreateCustomerId(userId);
    const liveSubscriptionId = await findLiveSubscriptionId(customer);
    if (liveSubscriptionId) {
      // Catch the stored plan up while we're here, then manage it instead.
      await syncSubscription(liveSubscriptionId);
      return createPortalSession();
    }

    const settingsUrl = getSettingsUrl();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: userId,
      line_items: [{ price: getPriceId(parsed.data), quantity: 1 }],
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
      success_url: `${settingsUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      // Back to the plan picker, which says checkout was canceled.
      cancel_url: `${getAppUrl()}${UPGRADE_PATH}?checkout=canceled`,
    });
    if (!session.url) {
      throw new Error(`Checkout session ${session.id} has no URL`);
    }

    return { success: true, data: { url: session.url }, error: null };
  } catch (error) {
    console.error("Creating checkout session failed", error);
    return actionFailure(CHECKOUT_FAILED);
  }
}

/**
 * Opens the Stripe Customer Portal, where the user switches between monthly
 * and yearly, cancels, updates their card and downloads invoices.
 */
export async function createPortalSession(): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return actionFailure(SESSION_EXPIRED);
  }

  try {
    if ((await getBillingStatus(userId))?.isDemo) {
      return actionFailure(DEMO_BILLING_CLOSED);
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: await getOrCreateCustomerId(userId),
      return_url: getSettingsUrl(),
    });
    return { success: true, data: { url: portal.url }, error: null };
  } catch (error) {
    console.error("Creating billing portal session failed", error);
    return actionFailure(BILLING_PORTAL_FAILED);
  }
}
