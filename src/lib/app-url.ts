/**
 * Absolute app origin for links that leave the browser tab - emails today,
 * Stripe's Checkout and Portal return URLs next - e.g. `https://devstash.io`.
 * Kept apart from `email.ts` so billing doesn't load the Resend client.
 */
export function getAppUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
