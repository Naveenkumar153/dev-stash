import type Stripe from "stripe";

import { errorResponse } from "@/lib/api-response";
import { syncSubscription } from "@/lib/db/billing";
import { getStripe, getWebhookSecret, toId } from "@/lib/stripe";

/**
 * Stripe -> DevStash subscription sync. There is no session here and the proxy
 * doesn't cover /api: Stripe's signature over the raw body is the
 * authentication, so the body is read as text (a parsed body fails the check).
 * No rate limit, so Stripe's own retries are never throttled, and the default
 * Node runtime, which the SDK's signature check needs.
 *
 * Handlers re-read the subscription from Stripe instead of trusting the event
 * payload, so retried, duplicated and out-of-order events all converge on
 * Stripe's current state.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return errorResponse("Missing Stripe signature.", 400);
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getWebhookSecret(),
    );
  } catch (error) {
    console.error("Stripe webhook signature check failed", error);
    return errorResponse("Invalid Stripe signature.", 400);
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // A 5xx makes Stripe retry with backoff for up to three days.
    console.error(`Handling Stripe event ${event.type} (${event.id}) failed`, error);
    return errorResponse("Webhook handler failed.", 500);
  }

  return Response.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = toId(session.subscription);
      if (session.mode === "subscription" && subscriptionId) {
        await syncSubscription(subscriptionId);
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await syncSubscription(event.data.object.id);
      return;
    case "invoice.payment_failed":
      // The status change to past_due / unpaid arrives as
      // customer.subscription.updated, so there is nothing to store here.
      return;
    default:
      // Acknowledged, so Stripe doesn't retry types this endpoint ignores.
      return;
  }
}
