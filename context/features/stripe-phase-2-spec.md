# Stripe Phase 2 — Integration & UI

## Overview

Connect DevStash Pro billing end to end on the Phase 1 foundation (`context/features/stripe-phase-1-spec.md`, which must be merged first). This phase adds:

- the Stripe webhook that keeps `isPro` in sync
- Checkout and Customer Portal server actions
- a Billing card on `/settings`
- Free-tier gating in the create paths
- subscription cancellation on account delete

Everything stays behind `PRO_GATING_ENABLED`: with it unset, billing works and `isPro` is recorded, but no account is restricted.

Testing needs **Stripe test mode and Stripe CLI** (`stripe listen`, `stripe trigger`, test clocks).

Reference: `docs/stripe-integration-plan.md` (§4.5, §4.8, §4.10, §5.4–§5.6, §6, §7).

## Stripe Dashboard Setup (test mode)

- Product **DevStash Pro** with two recurring USD prices: **$8 monthly** and **$72 yearly**. Their ids go in `.env` as `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_YEARLY`
- Customer Portal: payment method updates, invoice history, **cancel at end of billing period**, and switching between the two prices. Return URL `/settings`
- Retries: Smart Retries, and **cancel the subscription** when every retry fails
- Local webhooks: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, with the printed `whsec_…` as `STRIPE_WEBHOOK_SECRET` in `.env`
- The live-mode product, prices, Portal and production webhook endpoint are done at go-live and not in this phase

## Requirements

### Webhook: `src/app/api/webhooks/stripe/route.ts`

- `POST` reads the raw body with `request.text()` and verifies it with `constructEvent` against `stripe-signature` and `getWebhookSecret()`. A missing or invalid signature returns 400 (`errorResponse`) with no database call
- No session check (the signature is the authentication), no rate limit and no `runtime = "edge"`. `/api` is already outside the proxy matcher
- Events:
  - `checkout.session.completed`: when `mode === "subscription"`, `syncSubscription()` the session's subscription
  - `customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`: `syncSubscription()` the subscription id
  - `invoice.payment_failed`: acknowledged with no write (the status change arrives as `subscription.updated`)
  - Any other type returns 200
- Handlers re-read from Stripe rather than trusting the payload, so duplicates and out-of-order delivery converge. A thrown handler is logged with the event type and id and returns 500, so Stripe retries

### Checkout & Portal: `src/actions/billing.ts`

- `createCheckoutSession(interval)`:
  - Checks the session (`SESSION_EXPIRED`) and validates with `billingIntervalSchema`
  - A user who is already Pro gets `createPortalSession()` instead, so no second subscription is created
  - Otherwise creates a `mode: "subscription"` session with `getOrCreateCustomerId()`, `client_reference_id: userId`, the interval's price, `subscription_data.metadata.userId`, `allow_promotion_codes`, `success_url` `/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}` and `cancel_url` `/settings?checkout=canceled` (both from `getAppUrl()`)
  - Returns `BillingRedirectResult` with the URL; a thrown error is logged and returns `CHECKOUT_FAILED`
- `createPortalSession()`: a Portal session for the user's customer with `return_url` `/settings`, returning the URL or `BILLING_PORTAL_FAILED`
- Post-checkout sync: when `/settings` loads with `?checkout=success&session_id=…`, a data-layer function (e.g. `syncCheckoutForUser(userId, sessionId)` in `src/lib/db/billing.ts`) validates the id with `checkoutSessionIdSchema`, retrieves the session, and syncs its subscription **only if** `client_reference_id === userId`. Failures are logged, not thrown. The page then reads `getBillingStatus()`, so Pro shows before the webhook arrives
- The client opens the returned URL with `window.location.assign()`

### Feature gating (enforced only while `hasProAccess` is false)

- `createItem` (`src/actions/items.ts`): `getSessionEntitlements()` replaces `getSessionUserId()`; `canCreateItem()` runs inside the `try` before `ownsCollections()` and returns `ITEM_LIMIT_REACHED` with nothing written
- `createCollection` (`src/actions/collections.ts`): the same with `canCreateCollection()` and `COLLECTION_LIMIT_REACHED`
- `POST /api/items/upload`: `PRO_REQUIRED` (403) right after the session check, before the body is read; `ITEM_LIMIT_REACHED` (403) after validation and before `checkFolder()` / any R2 write; a failed count returns a logged 500 `ITEM_CREATE_FAILED`
- Downgraded users keep everything they have. Edit, delete, download, favorite, pin, folders and collection edit/delete are never gated
- Custom types, AI and export aren't built yet; they call `getSessionEntitlements()` when they are

### UI

- **Billing card on `/settings`** (`id="billing"`, right after the heading, before Editor preferences):
  - `BillingCard` (server): the plan name; Free usage as "N / 50 items · N / 3 collections" through `getUsage()`, loaded in the page's existing `Promise.all`; "Unlimited" for Pro
  - A notice for `?checkout=success` ("Welcome to Pro", or "Finishing up your upgrade… refresh in a moment" if the sync hasn't landed) and for `?checkout=canceled`
- `UpgradeButtons` (client): "Upgrade: $8/mo" and "Upgrade: $72/yr (save 25%)", using prices from `plans.ts`. Each calls `createCheckoutSession` in a `useTransition`, reads "Redirecting…" and is disabled while pending, and toasts `error` on failure. `?plan=yearly` emphasizes the yearly button
- `ManageBillingButton` (client): "Manage subscription" through `createPortalSession()`, shown to Pro users and to past subscribers (`hasCustomer`)
- **New Item dialog**: when `hasProAccess` is false, `ItemTypeSelector` still lists File / Image with the PRO badge (`isProItemType()`), but picking one shows an upgrade callout linking to `/settings#billing` in place of the upload field. Pass `hasProAccess` from `(app)/layout.tsx` (add `isPro` to `getSessionUser()` / `SessionUser`, plus `isProGatingEnabled()`). The server check stays authoritative
- **Limit errors**: the New Item and New Collection dialogs show `ITEM_LIMIT_REACHED` / `COLLECTION_LIMIT_REACHED` as their error toast with an "Upgrade" action linking to `/settings#billing`
- **Homepage**: the signed-in Pro card's "Upgrade to Pro" goes to `/settings?plan=<period>#billing` (a new `getUpgradeAction()` in `src/lib/homepage.ts`, unit tested); signed out stays `/register`

### Account deletion

- `deleteAccount` (`src/actions/profile.ts`): when the user has a `stripeSubscriptionId`, call `subscriptions.cancel()` **before** the transaction. If the cancel fails, log it and return "Couldn't cancel your subscription. Please try again." with nothing deleted. The Stripe customer is kept
- `DeleteAccountDialog` copy adds "This also cancels your Pro subscription immediately." when the user is Pro
- `scripts/reset-users.ts`: lists users with a subscription in the dry run and cancels their test-mode subscriptions before deleting under `--confirm`

### Docs

- `CLAUDE.md` Commands: the `stripe listen --forward-to localhost:3000/api/webhooks/stripe` line

## Unit Tests

Mock `@/lib/stripe`, `@/lib/prisma`, `@/auth` and `@/lib/usage-limits` as needed.

- `src/app/api/webhooks/stripe/route.test.ts`: missing signature → 400; invalid → 400 with no sync; each handled event calls `syncSubscription` with the right id; a one-time `checkout.session.completed` is ignored; an unknown type → 200; a handler throwing → 500. Either mock `constructEvent` or sign real payloads with `generateTestHeaderString` (no network)
- `src/actions/billing.test.ts`: signed out, invalid interval, a Pro user sent to the Portal, the exact Checkout params per interval, Stripe throwing → `CHECKOUT_FAILED`, Portal success and failure
- `syncCheckoutForUser`: another user's `client_reference_id` → no sync; a malformed id → no Stripe call; no subscription → no sync; a Stripe error is swallowed
- `src/actions/items.test.ts` / `collections.test.ts`: limit reached → limit error and no create; access → no count; the existing cases unchanged
- `src/app/api/items/upload/route.test.ts`: Free with the flag on → 403 `PRO_REQUIRED` before `formData()` and `putFile`; limit reached → 403 before R2; a failed count → 500
- `src/actions/profile.test.ts`: a subscriber's cancel runs before the transaction; a failed cancel → error with no transaction and no sign-out; no subscription → no Stripe call
- `getUpgradeAction()` in `homepage.test.ts`

## Browser & Stripe CLI Testing

Run with `stripe listen` and the dev server against `development`, using throwaway test accounts that are deleted afterwards (each one's test subscription canceled):

- [ ] Free user with the flag on: the Billing card shows Free and usage
- [ ] Monthly upgrade with `4242 4242 4242 4242` → back on `/settings` already Pro, with webhooks delivered 200 in the CLI; the DB has `isPro`, the customer id and the subscription id
- [ ] Yearly upgrade as a second user puts the $72 price on the subscription
- [ ] A Pro user's upgrade button opens the Portal
- [ ] A canceled Checkout shows the canceled notice, the user stays Free and Stripe has no subscription
- [ ] 3-D Secure `4000 0025 0000 3155` → Pro; declined `4000 0000 0000 0002` → stays Free
- [ ] Portal monthly ↔ yearly switch stays Pro; cancel at period end stays Pro until a test clock passes the period end, then Free with the customer id kept
- [ ] Re-subscribing reuses the customer
- [ ] Failed renewal with a test clock and `4000 0000 0000 0341`: `past_due` stays Pro, then canceled → Free
- [ ] `stripe events resend` of an old subscription's `deleted` after re-subscribing doesn't revoke Pro; resending `checkout.session.completed` changes nothing
- [ ] A junk `stripe-signature` gets 400 with no DB change
- [ ] Flag on, Free user: the 51st item and the 4th collection are refused with the toast; File / Image show the upgrade callout; a direct upload POST gets 403 with nothing in R2
- [ ] Flag off: every gate passes for a Free user
- [ ] Deleting a Pro account shows the subscription canceled in the Dashboard; with a bad key, the delete is refused and the account stays
- [ ] Homepage signed in: "Upgrade to Pro" lands on `/settings#billing` with the chosen period
- [ ] 390px: Billing card and New Item callout without horizontal scroll; no page errors
- [ ] `npm test`, lint, build and `db:status` pass

## Out of Scope

- Live mode, the production webhook endpoint and `.env.production` (go-live, plan §8 step 10). `AUTH_URL` must be set in production before then
- A `stripeCurrentPeriodEnd` column / "Renews on" date (the Portal shows it)
- Free trials, Stripe Tax and payment-failed emails from the app
- Custom types, AI and export features themselves
- Closing the count-then-create race on limits
