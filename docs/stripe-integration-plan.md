# Stripe Integration Plan — DevStash Pro

> Research date: 2026-11-18. Based on the codebase at `28c7c1c` (main).
> Pro pricing: **$8/month** or **$72/year**. SDK target: `stripe@23.1.0` (latest on npm today).

This plan is documentation only. Nothing in it has been implemented.

---

## 1. Current State Analysis

### 1.1 User model

`prisma/schema.prisma` already has every billing column the integration needs. They date from the first migration (`20260829101324_init`), with unique indexes on both Stripe ids:

```prisma
// Billing / entitlement
isPro                Boolean @default(false)
stripeCustomerId     String? @unique
stripeSubscriptionId String? @unique
```

- **No migration is required.** The plan below stores only these three fields. Stripe stays the source of truth for renewal dates, invoices and payment methods, and the Customer Portal shows them.
- *Optional, not recommended now:* a `stripeCurrentPeriodEnd DateTime?` column would let the app show "Renews on …" without a Stripe call. In API versions from `2025-03-31.basil` onward, `current_period_end` lives on `subscription.items.data[n]`, not on the subscription. Add the column only if the settings page needs that date.
- Nothing reads these columns yet. `isPro` appears only in `prisma/seed.ts:383` (`isPro: false` for the demo user) and `scripts/test-db.ts`. `isProItemType()` in `src/lib/item-types.ts:140` marks `file` / `image` with the sidebar's PRO badge, and its doc comment says it "does not gate anything on its own".

### 1.2 NextAuth configuration

- **Split config.** `src/auth.config.ts` is edge-safe and used by `src/proxy.ts`. It holds the GitHub provider, a placeholder Credentials provider and a `session` callback that copies `token.sub` to `session.user.id`. `src/auth.ts` spreads it, adds `PrismaAdapter(prisma)`, sets `session: { strategy: "jwt" }` and swaps in the real Credentials `authorize`.
- **There is no `jwt` callback today.** The JWT holds only the default claims plus `sub`.
- `src/types/next-auth.d.ts` adds only `id: string` to `Session["user"]`. There is no `JWT` augmentation.
- **The proxy** (`src/proxy.ts`) builds its own `NextAuth(authConfig)` without Prisma. Its matcher covers `/collections`, `/dashboard`, `/favorites`, `/items`, `/profile` and `/settings`, and **not `/api`**. A webhook route under `/api` therefore isn't intercepted, and every API route checks the session itself.
- **No client session.** Nothing uses `useSession()` or `SessionProvider`. Every Pro check will happen on the server.

### 1.3 How user data is accessed

| Helper | File | Reads | Used by |
| --- | --- | --- | --- |
| `getSessionUserId()` | `src/lib/session.ts` | `auth()` → `session.user.id` | every server action and API route (writes) |
| `getSessionUser()` | `src/lib/db/user.ts` | the user's **row** by session id (React `cache()`) | `(app)/layout.tsx` → sidebar |
| `getProfileUser()` | `src/lib/db/profile.ts` | the user's row, `hasPassword` instead of the hash | `/profile`, `/settings` |
| `getCurrentUserId()` | `src/lib/db/user.ts` | **the demo user** `demo@devstash.io` | every list/read query |

**Important split.** Reads still go through `getCurrentUserId()` (the demo account), while writes go through the session user. Free-tier counts **must use the session user**, because that is whose rows a create writes. Counting `getCurrentUserId()` would count the demo account's 18+ items for everyone.

The project's settled pattern is to read display data from the database row rather than the JWT, because "the JWT … is frozen at sign-in" (see `getSessionUser()`). The JWT sync in §2.4 removes that problem for `isPro` specifically.

### 1.4 Existing subscription / payment code

**None.** There is no `stripe` dependency, no billing route, action or env var, and no `STRIPE_*` entry in `.env.example` or `vitest.setup.ts`. Pricing exists only as marketing data:

- `src/lib/homepage.ts:170`: `PRO_PRICES = { monthly: 8, yearly: 72 }`, plus `getProPrice()` and `getYearlySavingsPercent()` (25%).
- `src/components/home/PricingSection.tsx`: the Pro card's button is `getStartAction(isSignedIn, "Upgrade to Pro")`, which sends signed-in visitors to `/dashboard`. The History notes this as open ("Upgrade to Pro only routes until billing exists").
- `src/components/home/Billing.tsx`: a client context holding the `monthly | yearly` toggle.

---

## 2. Feature Gating Analysis

### 2.1 Limits from the spec (`context/project-overview.md` §6)

| Capability | Free | Pro | Built today? |
| --- | --- | --- | --- |
| Items | 50 total | Unlimited | yes, not limited |
| Collections | 3 | Unlimited | yes, not limited |
| File & image uploads | ❌ | ✅ | yes, not gated |
| Custom types | ❌ | ✅ (later) | **no** |
| AI features | ❌ | ✅ | **no** |
| Export (JSON / ZIP) | ❌ | ✅ | **no** |

> **Dev note from the spec:** *"build the foundation for the Pro tier now (entitlement flags, gating hooks), but during development all users can access everything."* The plan therefore puts every gate behind a server-only flag, `PRO_GATING_ENABLED`, which is **off unless set to the exact string `true`**. This mirrors `isEmailVerificationEnabled()` in `src/lib/verification.ts`, but inverted: that flag is on unless set to `false`. With the flag off, Checkout and the webhook still work and `isPro` is still recorded, but nothing is blocked.

### 2.2 Where counts are (or should be) checked

Every create path goes through one server-side entry point:

| Limit | Entry point | Where to check |
| --- | --- | --- |
| 50 items (text/link) | `createItem()` action, `src/actions/items.ts:57` | after validation, inside the `try`, before `ownsCollections()` |
| 50 items (file/image) | `POST /api/items/upload`, `src/app/api/items/upload/route.ts` | after field validation and **before** `checkFolder()` / the R2 `putFile()`, so a blocked upload costs no R2 write |
| 3 collections | `createCollection()` action, `src/actions/collections.ts` | after validation, before `createCollectionRecord()` |
| file/image are Pro | same upload route | same place as the item limit |

Not gated: `updateItem`, `deleteItem`, favorites, pins, folders and collection edit/delete. A user who drops back to Free keeps everything they already have, over the limit or not, and can still read, edit, download and delete it. Only new creates are blocked. This is the simplest rule and it never loses data.

Counts are `prisma.item.count({ where: { userId } })` and `prisma.collection.count({ where: { userId } })`. Both hit existing composite indexes that lead with `userId`.

**Known race (accepted):** count-then-create isn't atomic, so two simultaneous creates at 49 items can reach 51. This matches how the codebase accepts the same race for folder-name clashes. Closing it would need a row lock or raw SQL, which the project avoids.

### 2.3 Pro-only features not yet built

Custom types, AI and export don't exist yet. The plan adds `requirePro()` / `hasProAccess()` now, and each of those features calls it in its own action or route when it's built. Nothing else is needed today.

### 2.4 Session sync: the approach from the research note

The research note asks for `isPro` to be re-read from the database inside the `jwt` callback on every validation, instead of relying on `trigger === "update"`. How it fits this codebase:

- It **must go in `src/auth.ts`**, not `src/auth.config.ts`. The edge proxy must never import Prisma (see the comment at the top of `auth.config.ts`). The proxy's own instance has no `jwt` callback, so it passes the token through unchanged, `isPro` included.
- The `session` callback in `auth.config.ts` (edge-safe, no DB) copies `token.isPro` onto `session.user.isPro`.
- Result: `auth()`, and therefore a new `getSessionEntitlements()`, returns an `isPro` that is at most one request old. Gating code needs **no extra query** beyond the one inside `auth()`, and a plain reload after Checkout picks up the change.
- Cost: one indexed primary-key `findUnique` per `auth()` call on the Node runtime. Today that means once per server action or API route, plus layout reads. Acceptable at this size.

### 2.5 Settings page structure

`src/app/settings/page.tsx` is standalone (outside the `(app)` shell), protected by the proxy, and re-checks `getProfileUser()`. It renders a `max-w-3xl` column of shadcn `Card`s: **Editor preferences** → **Change password** (only with a password) → **Delete account** (`ring-destructive/40`). A **Billing** card belongs right after the heading. Billing is the most important account setting, and the destructive card stays last.

---

## 3. API & Webhook Patterns

### 3.1 API routes

- Located at `src/app/api/<area>/route.ts`. Existing routes: `auth/[...nextauth]`, `auth/register`, `auth/verify-email`, `collections`, `items/[id]`, `items/[id]/file`, `items/upload`, `search`.
- Each route checks the session itself through `getSessionUserId()` and answers `errorResponse(SESSION_EXPIRED, 401)`, since the proxy doesn't cover `/api`.
- Replies use the `{ success, data, error }` shape via `errorResponse(error, status, { fieldErrors, headers })` in `src/lib/api-response.ts`. Reads add `Cache-Control: private, no-store`.
- Failures are logged with `console.error("<Doing X> failed", error)` and answered with a generic constant from `src/lib/action-result.ts`.
- Typed params use `RouteContext<"/api/items/[id]">`.
- The upload route is the model for multi-step work: it checks cheap things first, does the expensive write last, and rolls back on failure.

### 3.2 Server actions

- `"use server"` files in `src/actions/<feature>.ts`. Each one runs `getSessionUserId()` → `SESSION_EXPIRED`, then `schema.safeParse()` → first issue plus `getFieldErrors()`, then a `try` around the DB call → logged constant on throw.
- They return `{ success, data, error }` (and `fieldErrors` where a form shows them). Result types live in `src/types/<feature>.ts`.
- Mutations that change server-rendered data call `refresh()` from `next/cache` (e.g. `deleteCollection`, `setItemFavorite`).
- Queries live in `src/lib/db/<area>.ts` and are imported by actions under a `…Record` alias (`createItem as createItemRecord`).

### 3.3 Environment variables

- Read lazily inside a getter that throws `"<NAME> is not set"` (`src/lib/r2.ts` `getEnv()`, `src/lib/prisma.ts`), with the client created on first use (`client ??= …`).
- Feature flags are parsed by one function, which is their only reader (`isEmailVerificationEnabled()`).
- Every variable is documented in `.env.example` with a comment. Service variables are cleared in `vitest.setup.ts` so a missed mock fails loudly.
- **Environment caution.** `.env` and `.env.production` currently share the same Upstash database and R2 bucket. Stripe must **not** follow that pattern: `.env` holds **test-mode** keys and `.env.production` holds **live** keys, each with its own webhook secret. Remember also that `next start` loads `.env.production` (production Neon), so a local production build needs `DATABASE_URL` overridden.
- `getAppUrl()` (in `src/lib/email.ts`) returns `AUTH_URL`, falling back to `http://localhost:3000`. Checkout's success and cancel URLs need it too. Neither `.env` nor `.env.production` sets `AUTH_URL` today, so production must set it before billing ships, or Stripe will redirect paying users to localhost.

---

## 4. Files to Create

### 4.1 `src/lib/plans.ts` — Zod-free, client-safe constants

```ts
import { PRO_PRICES } from "@/lib/homepage";

/** Free-tier caps from the project spec. Pro has none. */
export const FREE_ITEM_LIMIT = 50;
export const FREE_COLLECTION_LIMIT = 3;

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export { PRO_PRICES };
```

(Alternatively, move `PRO_PRICES` here and have `homepage.ts` import it. Either way there is one copy of the prices.)

### 4.2 `src/lib/entitlements.ts` — the gating hooks

```ts
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/plans";

/**
 * Whether Free-tier limits are enforced. Off unless exactly "true", so during
 * development every account gets everything (project spec, §6 dev note).
 */
export function isProGatingEnabled(): boolean {
  return process.env.PRO_GATING_ENABLED === "true";
}

export interface SessionEntitlements {
  userId: string;
  /** The stored subscription state, synced into the JWT on every auth(). */
  isPro: boolean;
  /** What gates check: Pro, or gating switched off. */
  hasProAccess: boolean;
}

/** The signed-in user's id and plan, or null without a session. */
export async function getSessionEntitlements(): Promise<SessionEntitlements | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const isPro = session.user.isPro ?? false;
  return { userId, isPro, hasProAccess: isPro || !isProGatingEnabled() };
}

export type LimitCheck = { allowed: true } | { allowed: false; limit: number };

/** Whether the user may create one more item. */
export async function canCreateItem(userId: string, hasProAccess: boolean): Promise<LimitCheck> {
  if (hasProAccess) return { allowed: true };
  const count = await prisma.item.count({ where: { userId } });
  return count < FREE_ITEM_LIMIT ? { allowed: true } : { allowed: false, limit: FREE_ITEM_LIMIT };
}

/** Whether the user may create one more collection. */
export async function canCreateCollection(
  userId: string,
  hasProAccess: boolean,
): Promise<LimitCheck> {
  if (hasProAccess) return { allowed: true };
  const count = await prisma.collection.count({ where: { userId } });
  return count < FREE_COLLECTION_LIMIT
    ? { allowed: true }
    : { allowed: false, limit: FREE_COLLECTION_LIMIT };
}

/** Usage for the Billing card: counts against the Free caps. */
export async function getUsage(userId: string) {
  const [items, collections] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
  ]);
  return { items, collections };
}
```

### 4.3 `src/lib/stripe.ts` — lazy client and price lookup

```ts
import Stripe from "stripe";

import type { BillingInterval } from "@/lib/plans";

let client: Stripe | undefined;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

/**
 * Created on first use, like the R2 and Resend clients. No `apiVersion` is
 * passed: stripe-node pins the API version it was generated for, which keeps
 * the TypeScript types and the responses in agreement. Upgrading the SDK is
 * the upgrade path; set the webhook endpoint's API version to match.
 */
export function getStripe(): Stripe {
  client ??= new Stripe(getEnv("STRIPE_SECRET_KEY"), {
    appInfo: { name: "DevStash" },
    maxNetworkRetries: 2,
  });
  return client;
}

export function getWebhookSecret(): string {
  return getEnv("STRIPE_WEBHOOK_SECRET");
}

export function getPriceId(interval: BillingInterval): string {
  return getEnv(interval === "yearly" ? "STRIPE_PRICE_ID_YEARLY" : "STRIPE_PRICE_ID_MONTHLY");
}

/** Statuses that grant Pro. `past_due` keeps access while Stripe retries the card. */
const PRO_STATUSES: ReadonlySet<Stripe.Subscription.Status> = new Set([
  "active",
  "trialing",
  "past_due",
]);

export function isProStatus(status: Stripe.Subscription.Status): boolean {
  return PRO_STATUSES.has(status);
}

/** A customer or subscription field may be an id or an expanded object. */
export function toId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}
```

> Decision to confirm: `past_due` keeps Pro (Stripe's Smart Retries run for up to about 2 weeks by default). `unpaid`, `canceled`, `incomplete`, `incomplete_expired` and `paused` drop it. If the subscription ends up `canceled` or `unpaid` after retries, the webhook revokes Pro.

### 4.4 `src/lib/db/billing.ts` — the only writer of billing columns

```ts
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe, isProStatus, toId } from "@/lib/stripe";

export interface BillingStatus {
  isPro: boolean;
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
 * conditional update makes a double click keep the first customer: the loser
 * re-reads the winner's id. (Its stray customer has no subscription.)
 */
export async function getOrCreateCustomerId(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, stripeCustomerId: true },
  });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await getStripe().customers.create(
    { email: user.email, name: user.name ?? undefined, metadata: { userId } },
    { idempotencyKey: `customer-${userId}` },
  );

  const { count } = await prisma.user.updateMany({
    where: { id: userId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  if (count === 1) return customer.id;

  const winner = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });
  return winner.stripeCustomerId!;
}

/**
 * Writes a subscription's current state onto its user. Every webhook and the
 * post-checkout sync go through here with a freshly *retrieved* subscription,
 * so events arriving out of order or twice converge on Stripe's state.
 */
export async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = toId(subscription.customer);
  if (!customerId) return;

  if (isProStatus(subscription.status)) {
    await prisma.user.updateMany({
      where: { stripeCustomerId: customerId },
      data: { isPro: true, stripeSubscriptionId: subscription.id },
    });
    return;
  }

  // Only the user's *current* subscription can revoke Pro, so a late event for
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
```

`stripeCustomerId` is kept after cancellation, so re-subscribing reuses the same customer, payment methods and invoice history.

### 4.5 `src/actions/billing.ts` — Checkout, Portal and post-checkout sync

```ts
"use server";

import { refresh } from "next/cache";

import {
  BILLING_PORTAL_FAILED,
  CHECKOUT_FAILED,
  SESSION_EXPIRED,
} from "@/lib/action-result";
import { getAppUrl } from "@/lib/app-url";
import { billingIntervalSchema, checkoutSessionIdSchema } from "@/lib/billing-schemas";
import { getBillingStatus, getOrCreateCustomerId, syncSubscription } from "@/lib/db/billing";
import { getSessionUserId } from "@/lib/session";
import { getPriceId, getStripe, toId } from "@/lib/stripe";
import type { BillingRedirectResult } from "@/types/billing";

const SETTINGS_URL = () => `${getAppUrl()}/settings`;

/** Starts a hosted Checkout for Pro and returns its URL for the browser to open. */
export async function createCheckoutSession(interval: unknown): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, data: null, error: SESSION_EXPIRED };

  const parsed = billingIntervalSchema.safeParse(interval);
  if (!parsed.success) return { success: false, data: null, error: "Choose monthly or yearly." };

  try {
    const status = await getBillingStatus(userId);
    // A second subscription would double-bill: Pro users manage theirs in the Portal.
    if (status?.isPro) return createPortalSession();

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: await getOrCreateCustomerId(userId),
      client_reference_id: userId,
      line_items: [{ price: getPriceId(parsed.data), quantity: 1 }],
      subscription_data: { metadata: { userId } },
      allow_promotion_codes: true,
      success_url: `${SETTINGS_URL()}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SETTINGS_URL()}?checkout=canceled`,
    });
    if (!session.url) throw new Error("Checkout session has no URL");

    return { success: true, data: { url: session.url }, error: null };
  } catch (error) {
    console.error("Creating checkout session failed", error);
    return { success: false, data: null, error: CHECKOUT_FAILED };
  }
}

/** Opens the Stripe Customer Portal: plan switch, cancel, card, invoices. */
export async function createPortalSession(): Promise<BillingRedirectResult> {
  const userId = await getSessionUserId();
  if (!userId) return { success: false, data: null, error: SESSION_EXPIRED };

  try {
    const customer = await getOrCreateCustomerId(userId);
    const portal = await getStripe().billingPortal.sessions.create({
      customer,
      return_url: SETTINGS_URL(),
    });
    return { success: true, data: { url: portal.url }, error: null };
  } catch (error) {
    console.error("Creating billing portal session failed", error);
    return { success: false, data: null, error: BILLING_PORTAL_FAILED };
  }
}

/**
 * Called by the settings page on `?checkout=success`, so the new plan shows
 * even if the webhook hasn't arrived yet. The session is re-read from Stripe
 * and must belong to the caller, so a forged `session_id` changes nothing.
 */
export async function syncCheckoutSession(sessionId: string): Promise<void> {
  const userId = await getSessionUserId();
  const parsed = checkoutSessionIdSchema.safeParse(sessionId);
  if (!userId || !parsed.success) return;

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data);
    const subscriptionId = toId(session.subscription);
    if (session.client_reference_id !== userId || !subscriptionId) return;

    await syncSubscription(subscriptionId);
    refresh();
  } catch (error) {
    // The webhook will still apply it; the page shows a "finishing up" notice.
    console.error("Syncing checkout session failed", error);
  }
}
```

> `syncCheckoutSession` is called from a server component. Since `refresh()` is only valid inside a server action, the simplest implementation calls the data-layer function (not the action) directly from `page.tsx` before reading `getBillingStatus()`. In that case, move the body into `src/lib/db/billing.ts` as `syncCheckoutForUser(userId, sessionId)` and drop `refresh()`. The key requirement is the ownership check (`client_reference_id === userId`).

The client navigates with `window.location.assign(result.data.url)`. Calling `redirect()` to an external origin from a server action also works, but returning the URL keeps the `{ success, data, error }` pattern and lets the button toast a failure.

### 4.6 `src/lib/billing-schemas.ts`

```ts
import { z } from "zod";

import { BILLING_INTERVALS } from "@/lib/plans";

export const billingIntervalSchema = z.enum(BILLING_INTERVALS);

/** Stripe Checkout session ids look like `cs_test_…` / `cs_live_…`. */
export const checkoutSessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/);
```

### 4.7 `src/types/billing.ts`

```ts
export interface BillingRedirectResult {
  success: boolean;
  data: { url: string } | null;
  error: string | null;
}
```

### 4.8 `src/app/api/webhooks/stripe/route.ts` — the webhook

```ts
import type Stripe from "stripe";

import { errorResponse } from "@/lib/api-response";
import { applySubscription, syncSubscription } from "@/lib/db/billing";
import { getStripe, getWebhookSecret, toId } from "@/lib/stripe";

/**
 * Stripe → DevStash subscription sync. The signature is verified against the
 * raw body (a parsed body fails verification). The proxy doesn't cover /api, and
 * there is no session here: Stripe's signature is the authentication.
 *
 * Handlers re-read the subscription from Stripe instead of trusting the event
 * payload, so retries, duplicates and out-of-order delivery are all harmless.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return errorResponse("Missing signature.", 400);

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getWebhookSecret(),
    );
  } catch (error) {
    console.error("Stripe webhook signature check failed", error);
    return errorResponse("Invalid signature.", 400);
  }

  try {
    await handleEvent(event);
  } catch (error) {
    // A 500 makes Stripe retry with backoff for up to 3 days.
    console.error(`Handling Stripe event ${event.type} (${event.id}) failed`, error);
    return errorResponse("Webhook handler failed.", 500);
  }

  return Response.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const subscriptionId = toId(event.data.object.subscription);
      if (event.data.object.mode === "subscription" && subscriptionId) {
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
      // Status moves to past_due / unpaid and arrives as subscription.updated;
      // nothing extra to store. Hook for a "payment failed" email later.
      return;
    default:
      return; // Unsubscribed types: acknowledge so Stripe stops sending.
  }
}
```

Notes:
- `customer.subscription.deleted` still retrieves fine. A canceled subscription remains readable with `status: "canceled"`, so `applySubscription` revokes Pro. If you'd rather skip the round trip, call `applySubscription(event.data.object)` for `deleted` directly.
- No body-size cap is needed (Stripe payloads are small and signed), and **no rate limit**: Stripe retries would be throttled.
- Route handlers run on the Node runtime by default in Next 16, which `stripe` needs for `crypto`. Don't set `runtime = "edge"`.

### 4.9 `src/lib/app-url.ts` — small extraction

Move `getAppUrl()` out of `src/lib/email.ts` (re-export or update the two importers), so billing doesn't import the Resend module just to read `AUTH_URL`.

### 4.10 UI components

| File | Purpose |
| --- | --- |
| `src/components/settings/BillingCard.tsx` (server) | Card content: plan name, usage "12 / 50 items · 2 / 3 collections" (Free) or "Unlimited" (Pro), a checkout notice, and the client buttons below |
| `src/components/settings/UpgradeButtons.tsx` (client) | "Upgrade — $8/mo" and "Upgrade — $72/yr (save 25%)", each calling `createCheckoutSession(interval)` in a `useTransition`, then `window.location.assign(url)`, toasting `error` on failure; reads an optional `?plan=yearly` to focus that button |
| `src/components/settings/ManageBillingButton.tsx` (client) | "Manage subscription", which calls `createPortalSession()` and navigates; shown to Pro users and to ex-subscribers (`hasCustomer`) for invoice history |
| `src/components/billing/UpgradePrompt.tsx` (client, optional) | Shared toast action or inline callout "You've reached the Free limit of 50 items. Upgrade to Pro" linking to `/settings#billing`, used when an action returns a limit error |

Sketch of the card on the page:

```tsx
// src/app/settings/page.tsx (inside <main>, right after <h1>)
<Card id="billing" className="scroll-mt-6">
  <CardHeader>
    <CardTitle>Plan &amp; billing</CardTitle>
    <CardDescription>
      {billing.isPro ? "DevStash Pro: unlimited items, collections and uploads." : "Free plan"}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <BillingCard billing={billing} usage={usage} checkout={searchParams.checkout} />
  </CardContent>
</Card>
```

### 4.11 Tests (Vitest, colocated)

| File | Cases |
| --- | --- |
| `src/lib/entitlements.test.ts` | flag only on for exact `"true"` (`vi.stubEnv`); `hasProAccess` for Pro / Free × flag on/off; `canCreateItem` at 49 → allowed, 50 → blocked, Pro → no count query; same for collections at 2 / 3 |
| `src/lib/stripe.test.ts` | `isProStatus` for every status; `toId` for a string, an object and null; env getters throw when unset |
| `src/lib/db/billing.test.ts` | `applySubscription` active → sets Pro + id scoped by customer; canceled with matching id → revokes; canceled with an **older** id → `where` includes the subscription id (no-op); `getOrCreateCustomerId` existing id → no Stripe call; race loser re-reads the winner |
| `src/actions/billing.test.ts` | signed out, invalid interval, Pro user → portal instead of checkout, checkout params (`client_reference_id`, price per interval, success/cancel URLs), Stripe throws → `CHECKOUT_FAILED`; `syncCheckoutSession` ignores a session whose `client_reference_id` isn't the caller |
| `src/app/api/webhooks/stripe/route.test.ts` | missing signature → 400; bad signature → 400 with no DB call; each handled event → `syncSubscription` with the right id; unknown type → 200; handler throws → 500 |
| additions to `src/actions/items.test.ts`, `collections.test.ts`, `src/app/api/items/upload/route.test.ts` | limit reached → limit error and nothing written; image/file upload as Free with the flag on → 403 **before** `putFile`; flag off → allowed |

Mock `@/lib/stripe` (a stub with only the methods the code calls) alongside the existing `@/lib/prisma` and `@/auth` mocks. For the route, `constructEvent` can either be mocked or used for real with `stripe.webhooks.generateTestHeaderString({ payload, secret })`. That function is pure crypto with no network, so it's allowed under the "no real services" rule.

---

## 5. Files to Modify

| File | Change |
| --- | --- |
| `package.json` | add `stripe@^23.1.0` |
| `src/auth.ts` | add the `jwt` callback (below), keeping `authConfig.callbacks` spread |
| `src/auth.config.ts` | `session` callback also copies `token.isPro` (edge-safe, no DB) |
| `src/types/next-auth.d.ts` | add `isPro` to `Session["user"]` and a `JWT` augmentation |
| `src/lib/action-result.ts` | add `ITEM_LIMIT_REACHED`, `COLLECTION_LIMIT_REACHED`, `PRO_REQUIRED`, `CHECKOUT_FAILED`, `BILLING_PORTAL_FAILED` |
| `src/actions/items.ts` | `createItem`: `getSessionEntitlements()` in place of `getSessionUserId()`, then `canCreateItem()` |
| `src/actions/collections.ts` | `createCollection`: same, with `canCreateCollection()` |
| `src/app/api/items/upload/route.ts` | Pro check (403 `PRO_REQUIRED`) + item limit (403 `ITEM_LIMIT_REACHED`) before `checkFolder()` / R2 |
| `src/actions/profile.ts` | `deleteAccount`: **cancel the Stripe subscription first** (below) |
| `src/app/settings/page.tsx` | Billing card; reads `searchParams.checkout` / `session_id`; loads `getBillingStatus()` + `getUsage()` in the existing `Promise.all` |
| `src/lib/db/user.ts` + `src/types/auth.ts` | optional: `isPro` on `SessionUser` so the sidebar can show a "Pro" chip and the shell can pass `hasProAccess` to `NewItemDialog` |
| `src/components/items/ItemTypeSelector.tsx` / `NewItemForm.tsx` | when `!hasProAccess`, show `file` / `image` with the PRO badge and an upgrade hint instead of the upload field (the server still enforces it) |
| `src/lib/homepage.ts` + `PricingSection.tsx` | signed-in "Upgrade to Pro" → `/settings?plan=<period>#billing` (via a new `getUpgradeAction()`), signed out → `/register` as today |
| `.env.example` | document the `STRIPE_*` vars and `PRO_GATING_ENABLED` |
| `vitest.setup.ts` | add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_YEARLY` to `SERVICE_VARS`, and `PRO_GATING_ENABLED` to `SETTING_VARS` |
| `scripts/reset-users.ts` | cancel each deleted user's test-mode subscription (or refuse users with `stripeSubscriptionId` unless `--confirm`), so dev runs don't leave live test subscriptions behind |
| `CLAUDE.md` | add the `stripe listen` dev command (§7) |

### 5.1 `src/auth.ts` — JWT sync (from the research note)

```ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: /* unchanged */,
  callbacks: {
    ...authConfig.callbacks,
    // Node-only (Prisma), so it lives here and not in the edge-safe config.
    // Re-reading isPro on every validation means a webhook's change shows on
    // the next request; `trigger === "update"` isn't needed.
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isPro: true },
        });
        token.isPro = dbUser?.isPro ?? false;
      }

      return token;
    },
  },
});
```

### 5.2 `src/auth.config.ts` — `session` callback

```ts
session({ session, token }) {
  if (token.sub) {
    session.user.id = token.sub;
  }
  session.user.isPro = token.isPro === true;
  return session;
},
```

### 5.3 `src/types/next-auth.d.ts`

```ts
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isPro: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isPro?: boolean;
  }
}
```

> Check the `next-auth/jwt` module path against `next-auth@5.0.0-beta.32`'s exports when implementing. In v5 the `JWT` type is re-exported from `@auth/core/jwt`, and augmenting `next-auth/jwt` is the documented route.

### 5.4 `createItem` action

```ts
export async function createItem(data: CreateItemInput): Promise<CreateItemResult> {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) return failure(SESSION_EXPIRED);
  const { userId, hasProAccess } = entitlements;

  const parsed = createItemSchema.safeParse(data);
  if (!parsed.success) {
    return failure(parsed.error.issues[0].message, getFieldErrors(parsed.error));
  }

  try {
    if (!(await canCreateItem(userId, hasProAccess)).allowed) {
      return failure(ITEM_LIMIT_REACHED);
    }
    if (!(await ownsCollections(userId, parsed.data.collectionIds))) {
      return collectionsFailure();
    }
    // …unchanged
```

`createCollection` follows the same pattern with `canCreateCollection()` and `COLLECTION_LIMIT_REACHED`.

### 5.5 Upload route

```ts
export async function POST(request: Request) {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) return uploadFailure(SESSION_EXPIRED, 401);
  const { userId, hasProAccess } = entitlements;

  // File and image items are Pro. Checked before the body is read.
  if (!hasProAccess) return uploadFailure(PRO_REQUIRED, 403);

  // …content-length check, form parse, validation…

  try {
    if (!(await canCreateItem(userId, hasProAccess)).allowed) {
      return uploadFailure(ITEM_LIMIT_REACHED, 403);
    }
  } catch (error) {
    console.error("Checking item limit failed", error);
    return uploadFailure(ITEM_CREATE_FAILED, 500);
  }

  // …checkFolder, checkCollections, storeAndCreate (unchanged)
```

Because every file/image is Pro, the item-limit check in this route only matters if a future rule lets Free users upload. It's cheap and keeps the rule in one place.

### 5.6 `deleteAccount`: cancel before deleting

Without this, a deleted account **keeps being billed**: Stripe has no idea the user is gone.

```ts
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { email: true, stripeSubscriptionId: true },
});
// …demo check…

if (user.stripeSubscriptionId) {
  try {
    // Immediate cancel, no proration refund (decide: or prorate: true).
    await getStripe().subscriptions.cancel(user.stripeSubscriptionId);
  } catch (error) {
    console.error("Canceling subscription before account delete failed", error);
    return { success: false, data: null, error: "Couldn't cancel your subscription. Please try again." };
  }
}
// …existing $transaction, discardUserFiles, signOut
```

Leave the Stripe customer in place for accounting and refunds. After the user row is gone, the `subscription.deleted` webhook finds no user to update and is a no-op.

Update the Delete account dialog copy: "This also cancels your Pro subscription immediately."

### 5.7 New error constants (`src/lib/action-result.ts`)

```ts
export const ITEM_LIMIT_REACHED =
  `You've reached the Free plan's limit of ${FREE_ITEM_LIMIT} items. Upgrade to Pro for unlimited items.`;
export const COLLECTION_LIMIT_REACHED =
  `You've reached the Free plan's limit of ${FREE_COLLECTION_LIMIT} collections. Upgrade to Pro for unlimited collections.`;
export const PRO_REQUIRED = "File and image uploads are a Pro feature.";
export const CHECKOUT_FAILED = "Couldn't start checkout. Please try again.";
export const BILLING_PORTAL_FAILED = "Couldn't open billing. Please try again.";
```

(Import the limits from `src/lib/plans.ts`, which is Zod-free, so `action-result.ts` stays client-safe.)

### 5.8 `.env.example`

```bash
# Stripe (test-mode keys locally, live keys only in production)
STRIPE_SECRET_KEY=
# From `stripe listen` locally, or the Dashboard endpoint's signing secret in production.
STRIPE_WEBHOOK_SECRET=
# Recurring prices of the "DevStash Pro" product: $8/month and $72/year.
STRIPE_PRICE_ID_MONTHLY=
STRIPE_PRICE_ID_YEARLY=
# Set to "true" to enforce Free-tier limits and Pro-only features. Anything
# else (or unset) gives every account full access, as during development.
PRO_GATING_ENABLED=
```

No publishable key is needed: hosted Checkout and the Portal are full-page redirects, with no Stripe.js on the client.

---

## 6. Stripe Dashboard Setup

Do all of this in **test mode** first, then repeat it in live mode. Products, prices, Portal settings and webhooks are separate per mode.

1. **Account basics:** business name "DevStash", support email, statement descriptor (e.g. `DEVSTASH`), and branding (icon, the blue brand color) under *Settings → Branding*, which also styles Checkout and the Portal.
2. **Product:** *Product catalog → Add product* → name **DevStash Pro**, description "Unlimited items and collections, file & image uploads, AI features, export."
   - Price 1: **$8.00 USD, recurring, monthly**. Lookup key `devstash_pro_monthly`. Copy the `price_…` id to `STRIPE_PRICE_ID_MONTHLY`.
   - Price 2: **$72.00 USD, recurring, yearly**. Lookup key `devstash_pro_yearly`. Copy the id to `STRIPE_PRICE_ID_YEARLY`.
3. **Customer Portal:** *Settings → Billing → Customer portal*:
   - Allow: update payment methods, view invoice history, update billing address/email.
   - Cancellations: **allow, at end of billing period** (the subscription stays `active` with `cancel_at_period_end`, so Pro remains until the period ends, then `subscription.deleted` revokes it). Optionally collect a cancellation reason.
   - Subscription updates: allow switching between the monthly and yearly prices of DevStash Pro (add both to the product list), with proration as you prefer.
   - Default return URL: `https://<your-domain>/settings`. Save.
4. **Checkout settings:** enable the payment methods you want (cards at minimum). Optionally turn on Stripe Tax and set `automatic_tax` in the session later.
5. **Emails:** *Settings → Customer emails* → enable successful payment receipts and refunds; enable "failed payment" and "expiring card" emails under *Billing → Subscriptions and emails*.
6. **Retries:** *Billing → Revenue recovery → Retries*: Smart Retries, and decide the final action after all retries fail (**cancel the subscription** fits §4.3, since `canceled` revokes Pro).
7. **Webhook endpoint (production):** *Developers → Webhooks → Add endpoint* → URL `https://<your-domain>/api/webhooks/stripe`. Set the API version to the one `stripe@23.1.0` pins (shown in the SDK's `apiVersion` constant / changelog). Events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `invoice.payment_failed`

   Copy the signing secret (`whsec_…`) to `STRIPE_WEBHOOK_SECRET` in production.
8. **API keys:** *Developers → API keys* → the secret key goes to `STRIPE_SECRET_KEY`. Prefer a **restricted key** with write access to Customers, Checkout Sessions, Customer Portal and Subscriptions only.
9. **Local webhooks:** install the Stripe CLI, `stripe login`, then `stripe listen --forward-to localhost:3000/api/webhooks/stripe`. Put the printed `whsec_…` in `.env` as `STRIPE_WEBHOOK_SECRET`.

---

## 7. Testing Checklist

### Unit (`npm test`)
- [ ] All cases in §4.11 pass; the new modules are at full line/branch coverage like the other action/lib modules.
- [ ] Existing `items`, `collections` and upload-route tests still pass with `getSessionEntitlements` mocked (Pro or flag off → behavior unchanged).

### Local end-to-end (test mode, `stripe listen` running, `PRO_GATING_ENABLED=true`)
- [ ] Free user: `/settings` shows the Free plan and usage counts.
- [ ] Upgrade monthly with card `4242 4242 4242 4242` → lands on `/settings?checkout=success…` already showing **Pro** (post-checkout sync), and the CLI shows the events delivered with 200.
- [ ] DB (Neon MCP, `development` branch, read-only `SELECT`): `isPro = true`, `stripeCustomerId` and `stripeSubscriptionId` set.
- [ ] Reload any page: `auth()` reports `isPro: true` (JWT sync) and file/image types are unlocked in New Item.
- [ ] Upgrade yearly as a second user → the $72 price is on the subscription.
- [ ] Pro user clicking an upgrade button is sent to the Portal, not a second Checkout.
- [ ] Cancel the Checkout → `?checkout=canceled` notice, still Free, no subscription in Stripe.
- [ ] 3-D Secure card `4000 0025 0000 3155` → authentication modal → Pro.
- [ ] Declined card `4000 0000 0000 0002` → Checkout shows the error, user stays Free.
- [ ] Portal: switch monthly ↔ yearly → `subscription.updated`, still Pro.
- [ ] Portal: cancel at period end → still Pro. Then with a **test clock** (or `stripe subscriptions cancel` for an immediate cancel) → `subscription.deleted` → `isPro = false`, `stripeSubscriptionId = null`, `stripeCustomerId` kept.
- [ ] Re-subscribe after canceling → the same customer is reused and Pro is restored.
- [ ] Failed renewal: test clock with card `4000 0000 0000 0341` → `past_due` (still Pro) → after retries, `canceled` → Free.
- [ ] Stale event: replay an old subscription's `deleted` (`stripe events resend evt_…`) after re-subscribing → Pro is **not** revoked.
- [ ] Duplicate delivery: resend the same `checkout.session.completed` → no error, state unchanged.
- [ ] Webhook with a bad signature (`curl -X POST` with a junk `stripe-signature`) → 400, no DB change.

### Gating (flag on, Free user)
- [ ] 50th item creates; the 51st shows the limit toast/inline error, and nothing is written.
- [ ] 3rd collection creates; the 4th is refused.
- [ ] Image/file upload refused with 403 `PRO_REQUIRED` and no object in R2 (list the user's prefix).
- [ ] Over-limit after downgrade: existing items/collections/files still open, edit, download and delete.
- [ ] Flag **off**: every gate passes for a Free user (the dev default).

### Account deletion
- [ ] Pro user deletes their account → the subscription shows **canceled** in the Stripe Dashboard, then the account is removed. With Stripe unreachable (bad key), the delete is refused with the error and the account stays.

### Regression
- [ ] `npm run lint`, `npm run build`, `npm run db:status` pass (no migration expected).
- [ ] Signed-out `/settings` still 302s to `/sign-in?callbackUrl=%2Fsettings`, and the proxy bundle has no Prisma or Stripe import.
- [ ] Homepage: signed-in "Upgrade to Pro" lands on `/settings#billing` with the chosen period.

### Before going live
- [ ] Live product, prices, Portal and webhook created (§6), with live keys only in `.env.production`.
- [ ] `AUTH_URL` set in production (success/cancel/return URLs).
- [ ] One real live-mode purchase and refund with your own card.

---

## 8. Implementation Order

Each step leaves the app working, and with `PRO_GATING_ENABLED` unset nothing visible changes until step 7.

1. **Stripe Dashboard (test mode):** product, two prices, Portal, CLI login (§6 steps 1–5, 8, 9). Fill `.env` and `.env.example`; update `vitest.setup.ts`.
2. **Foundation libs:** `npm i stripe`; `src/lib/plans.ts`, `src/lib/stripe.ts`, `src/lib/app-url.ts`, `src/lib/billing-schemas.ts`, `src/types/billing.ts`, plus tests.
3. **Session sync:** the `jwt` callback in `auth.ts`, the `session` callback in `auth.config.ts`, the type augmentation. Verify `auth()` returns `isPro` and the proxy build still excludes Prisma.
4. **Entitlements:** `src/lib/entitlements.ts`, the error constants, tests (flag parsing, limit boundaries).
5. **Billing data layer + webhook:** `src/lib/db/billing.ts` and `src/app/api/webhooks/stripe/route.ts`, plus tests. Verify with `stripe trigger customer.subscription.created` against a test user whose `stripeCustomerId` you set.
6. **Checkout & Portal:** `src/actions/billing.ts`, the Billing card on `/settings`, the post-checkout sync. Run the local end-to-end checklist.
7. **Enforce gates:** `createItem`, `createCollection`, the upload route, and the New Item type selector's Pro state. Test with the flag on and off.
8. **Account deletion + reset script:** cancel-before-delete in `deleteAccount`, the dialog copy, `scripts/reset-users.ts`.
9. **Homepage & polish:** the signed-in "Upgrade to Pro" link, an optional sidebar "Pro" chip, limit-error upgrade prompts.
10. **Go live:** repeat §6 in live mode, create the production webhook, set `.env.production` (`STRIPE_*`, `AUTH_URL`, and `PRO_GATING_ENABLED=true` when ready), deploy, then a real purchase and refund.

Steps 2–6 can be one feature branch (`feature/stripe-billing`); 7–9 can be a second (`feature/pro-gating`), so billing can ship and be tested before any user is restricted.

---

## 9. Open Decisions

| # | Question | Default in this plan |
| --- | --- | --- |
| 1 | Does `past_due` keep Pro? | Yes, until retries end in `canceled` / `unpaid` |
| 2 | Over-limit after a downgrade | Keep everything, block only new creates |
| 3 | Account deletion refund | Immediate cancel, no proration |
| 4 | Gate flag default | Off (spec dev note); turn on in production when billing is live |
| 5 | Free trial | None (would be `subscription_data.trial_period_days`) |
| 6 | Store the period end | No; the Portal shows it. Add `stripeCurrentPeriodEnd` later if the settings page needs "Renews on" |
| 7 | Demo account | Stays Free (`isPro: false` in the seed). With the flag on it is limited too, and it already has 18+ items, under 50 |

### Related caveats from earlier features
- The session-versus-`getCurrentUserId()` split: lists show the demo user's data while limits count the session user's rows. They agree only for the demo account until reads move to the session user.
- The count-then-create race (§2.2) can let a Free user slightly exceed a limit with simultaneous requests.
