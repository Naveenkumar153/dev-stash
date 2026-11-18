/** Checkout and Customer Portal actions: the Stripe-hosted URL to open. */
export interface BillingRedirectResult {
  success: boolean;
  data: { url: string } | null;
  error: string | null;
}
