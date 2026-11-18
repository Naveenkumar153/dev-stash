# Stripe Phase 1 — Core Infrastructure

## Overview

Lay the billing foundation for DevStash Pro ($8/month, $72/year) without any user-facing change. This phase adds the Stripe SDK and client, plan constants, the usage-limits module (the gating hooks), the billing data layer that writes `isPro`, and the JWT sync that puts `isPro` on the session. Nothing calls Stripe from the UI yet. No webhook or Checkout exists, and no limit is enforced. Phase 2 (`context/features/stripe-phase-2-spec.md`) wires these pieces in.

Everything here is verifiable with unit tests, lint and build. It does **not** need Stripe CLI, a webhook or a real payment.

Reference: `docs/stripe-integration-plan.md` (§1–§5, §8 steps 1–5).

## Requirements

### Dependency and environment

- Add `stripe@^23.1.0`
- `.env.example`: document `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY` and `PRO_GATING_ENABLED` (plan §5.8). No publishable key: Checkout and the Portal are redirects
- `.env`: **test-mode** keys only. `.env.production` is not touched in this phase
- `vitest.setup.ts`: add the four `STRIPE_*` vars to `SERVICE_VARS` and `PRO_GATING_ENABLED` to `SETTING_VARS`

### `src/lib/plans.ts` (Zod-free, client-safe)

- `FREE_ITEM_LIMIT = 50`, `FREE_COLLECTION_LIMIT = 3`
- `BILLING_INTERVALS = ["monthly", "yearly"] as const` and `BillingInterval`
- One copy of the prices: move `PRO_PRICES` here from `src/lib/homepage.ts` and have `homepage.ts` import it (homepage output unchanged)

### `src/lib/usage-limits.ts` (the gating hooks)

- `isProGatingEnabled()`: true only for the exact string `"true"`. Unset or anything else means every account gets everything, per the spec's dev note. It is the only reader of `PRO_GATING_ENABLED`
- `getSessionEntitlements()`: `{ userId, isPro, hasProAccess }` from `auth()`, or null when signed out. `hasProAccess = isPro || !isProGatingEnabled()`. Gates check `hasProAccess`, never `isPro`
- `canCreateItem(userId, hasProAccess)` / `canCreateCollection(userId, hasProAccess)`: `{ allowed: true }` or `{ allowed: false, limit }`. With access there is no count query; otherwise one `count` scoped to `userId`, allowed while `count < limit`
- `getUsage(userId)`: `{ items, collections }` counts in one `Promise.all`, for Phase 2's Billing card
- Counts always use the **session user** passed in, never `getCurrentUserId()` (the demo user)

### `src/lib/stripe.ts`

- `getStripe()`: a lazy client (`client ??= new Stripe(...)`), with no `apiVersion` (the SDK's pinned version), `appInfo: { name: "DevStash" }` and `maxNetworkRetries: 2`. Throws `"STRIPE_SECRET_KEY is not set"` when missing, like `src/lib/r2.ts`
- `getWebhookSecret()` and `getPriceId(interval)`, each throwing when their env var is unset
- `isProStatus(status)`: true for `active`, `trialing` and `past_due`; false for every other `Stripe.Subscription.Status`
- `toId(value)`: the id from a string, an expanded object, or null

### `src/lib/db/billing.ts` (the only writer of billing columns)

- `getBillingStatus(userId)`: `{ isPro, hasCustomer }` or null
- `getOrCreateCustomerId(userId)`: returns the stored id, or creates the customer with `metadata.userId` and `idempotencyKey: customer-${userId}`, then saves it with `updateMany({ where: { id, stripeCustomerId: null } })`. A losing race re-reads the winner's id
- `applySubscription(subscription)`: for a Pro status, `updateMany` by `stripeCustomerId` sets `isPro: true` and `stripeSubscriptionId`. Otherwise `updateMany` by `stripeCustomerId` **and** `stripeSubscriptionId: subscription.id` sets `isPro: false` and the id to null, so an older subscription's late event can't revoke a newer one. `stripeCustomerId` is never cleared
- `syncSubscription(subscriptionId)`: `subscriptions.retrieve` then `applySubscription`

### Session sync (from `context/research/stripe-integration-research.md`)

- `src/auth.ts`: add a `jwt` callback (spreading `authConfig.callbacks`) that re-reads `isPro` by `token.sub` on every validation and sets `token.isPro` (false when the row is gone). Don't use `trigger === "update"`. It must live here, not in `auth.config.ts`, which the edge proxy loads and which must stay Prisma-free
- `src/auth.config.ts`: the `session` callback also sets `session.user.isPro = token.isPro === true`
- `src/types/next-auth.d.ts`: `isPro: boolean` on `Session["user"]` and an `isPro?: boolean` `JWT` augmentation (check the module path against `next-auth@5.0.0-beta.32`)

### Supporting modules

- `src/lib/billing-schemas.ts`: `billingIntervalSchema` (`z.enum(BILLING_INTERVALS)`) and `checkoutSessionIdSchema` (`/^cs_(test|live)_[A-Za-z0-9]+$/`)
- `src/types/billing.ts`: `BillingRedirectResult` (`{ success, data: { url } | null, error }`)
- `src/lib/app-url.ts`: move `getAppUrl()` out of `src/lib/email.ts` and update its importers, so billing doesn't load the Resend module
- `src/lib/action-result.ts`: `ITEM_LIMIT_REACHED`, `COLLECTION_LIMIT_REACHED` (built from the `plans.ts` limits), `PRO_REQUIRED`, `CHECKOUT_FAILED` and `BILLING_PORTAL_FAILED` (copy in plan §5.7). The module must stay Zod-free and client-safe

## Unit Tests

Colocated `<file>.test.ts`, mocking `@/auth`, `@/lib/prisma` and `@/lib/stripe` / the `stripe` package as needed. No real Stripe calls.

- **`src/lib/usage-limits.test.ts`** (required):
  - `isProGatingEnabled`: `"true"` → true; unset, `""`, `"TRUE"`, `"1"`, `" true"`, `"false"` → false (`vi.stubEnv`)
  - `getSessionEntitlements`: signed out → null; Pro → `hasProAccess` true with the flag on or off; Free + flag off → true; Free + flag on → false; a missing `isPro` on the session counts as false
  - `canCreateItem`: access → allowed with **no** `count` call; Free at 0 / 49 → allowed; at 50 / 51 → `{ allowed: false, limit: 50 }`; `where` is exactly `{ userId }`
  - `canCreateCollection`: the same at 2 → allowed and at 3 → `{ allowed: false, limit: 3 }`
  - `getUsage`: both counts scoped to `userId`; a failing count rejects
- `src/lib/stripe.test.ts`: `isProStatus` for every status, `toId` for a string, an object and null, and each env getter throwing when unset
- `src/lib/db/billing.test.ts`: `applySubscription` active / trialing / past_due → sets Pro scoped by customer; canceled / unpaid / incomplete_expired → revoke `where` includes the subscription id; customer missing → no write. `getOrCreateCustomerId` existing id → no Stripe call; new → customer created with the idempotency key and saved conditionally; race lost → returns the re-read id
- `src/lib/billing-schemas.test.ts`: both intervals accepted, others rejected; test and live session ids accepted; `cs_` alone, other prefixes and `{CHECKOUT_SESSION_ID}` rejected
- `src/lib/plans.ts` / homepage: the existing `homepage.test.ts` still passes after `PRO_PRICES` moves
- Session callbacks: a test for the `session` callback copying `isPro` (and false when absent), if it can be done without loading the NextAuth runtime. Otherwise verify it in the browser

## Verification

- `npm test`, `npm run lint`, `npm run build` and `npm run db:status` pass (no migration: the `isPro` / `stripeCustomerId` / `stripeSubscriptionId` columns already exist)
- The build's proxy bundle has no Prisma or Stripe import
- In the dev server, signed in as the demo user: the pages render as before; `auth()` returns `isPro: false`. Temporarily `UPDATE users SET "isPro" = true WHERE email = 'demo@devstash.io'` on `development` only (approved first), reload, confirm `isPro: true` without signing out, then revert it

## Out of Scope (Phase 2)

- The webhook route, Checkout / Portal server actions and the post-checkout sync
- Enforcing any limit or Pro gate in `createItem`, `createCollection` or the upload route
- The Billing card on `/settings`, New Item's Pro state, the homepage Upgrade link
- Canceling the subscription on account delete, and `scripts/reset-users.ts`
- Stripe Dashboard webhook setup and Stripe CLI testing
