"use server";

import { BILLING_PORTAL_FAILED, CHECKOUT_FAILED, SESSION_EXPIRED } from "@/lib/action-result";
import { getAppUrl } from "@/lib/app-url";
import { billingIntervalSchema } from "@/lib/billing-schemas";
import { getBillingStatus, getOrCreateCustomerId } from "@/lib/db/billing";
import { UPGRADE_PATH } from "@/lib/plans";
import { getSessionUserId } from "@/lib/session";
import { getPriceId, getStripe } from "@/lib/stripe";
import type { BillingRedirectResult } from "@/types/billing";

/** Where Checkout's success and the Portal return to: the Billing card syncs there. */
function getSettingsUrl(): string {
  return `${getAppUrl()}/settings`;
}

function failure(error: string): BillingRedirectResult {
  return { success: false, data: null, error };
}

/**
 * Starts a Stripe-hosted Checkout for Pro at the chosen interval and returns
 * its URL for the browser to open. A user who is already Pro gets the Customer
 * Portal instead, so a second click can't start a second subscription.
 */
export async function createCheckoutSession(interval: unknown): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  const parsed = billingIntervalSchema.safeParse(interval);
  if (!parsed.success) {
    return failure("Choose monthly or yearly billing.");
  }

  try {
    const status = await getBillingStatus(userId);
    if (status?.isPro) {
      return createPortalSession();
    }

    const settingsUrl = getSettingsUrl();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: await getOrCreateCustomerId(userId),
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
    return failure(CHECKOUT_FAILED);
  }
}

/**
 * Opens the Stripe Customer Portal, where the user switches between monthly
 * and yearly, cancels, updates their card and downloads invoices.
 */
export async function createPortalSession(): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return failure(SESSION_EXPIRED);
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: await getOrCreateCustomerId(userId),
      return_url: getSettingsUrl(),
    });
    return { success: true, data: { url: portal.url }, error: null };
  } catch (error) {
    console.error("Creating billing portal session failed", error);
    return failure(BILLING_PORTAL_FAILED);
  }
}
