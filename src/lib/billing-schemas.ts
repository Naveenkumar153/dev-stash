import { z } from "zod";

import { BILLING_INTERVALS } from "@/lib/plans";

/** The billing interval a Checkout session is started for. */
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);

/**
 * A Stripe Checkout session id from the success URL, e.g. `cs_test_a1B2…`.
 * Checked before it reaches the Stripe API, so a hand-edited URL (or the
 * unreplaced `{CHECKOUT_SESSION_ID}` template) never becomes a request.
 */
export const checkoutSessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/);
