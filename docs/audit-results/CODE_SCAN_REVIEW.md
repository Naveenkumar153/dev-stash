# Code Scan Review

**Date:** 2026-11-20
**Run by:** `code-scanner` subagent, whole codebase (`src/`, `prisma/`, `scripts/`, root config)
**Excluded:** `src/generated/prisma/`, `src/components/ui/`, test files, AI features (not built)
**State at scan:** `main` at `73c0880`, 957 unit tests passing, ESLint and `tsc --noEmit` clean.
**Earlier reports:** items still present from the 2026-11-14 scan and `AUTH_SECURITY_REVIEW.md` are marked _(previously reported)_.

**Result:** 0 Critical, 1 High, 9 Medium, 25 Low.

---

## Critical

None found.

## High

### H1. The search palette reads every item's full content on each app load and palette open
`src/lib/db/items.ts:332-370`, `src/hooks/use-search-data.ts:63-67`, `src/components/search/SearchPaletteProvider.tsx:70-78`

`getSearchItems()` has no `take` and selects `content` for every item, then cuts it to a 200-character preview in memory. It runs when the shell mounts and again on every Cmd+K. Content has no length limit and Pro has no item limit, so 3,000 snippets of 5 KB means about 15 MB read per page load to send 600 KB of previews.
**Fix:** store the preview in an `Item.preview` column written on create and update (with a backfill), select it instead of the payloads, load on the first palette open rather than on mount, and cap the rows.

## Medium

### M1. A second Checkout can start while a subscription is live; account deletion cancels only one
`src/actions/billing.ts:38-54`, `src/lib/db/billing.ts:77-81`, `src/actions/profile.ts:131`
Checkout is skipped only when the stored `isPro` is true. If the post-checkout sync fails and the webhook is late, two tabs, a second visit to `/upgrade` or Back from Checkout start a second subscription. `deleteAccount` then cancels only the stored one and the other keeps billing.
**Fix:** list the customer's subscriptions in Stripe before creating a session and send any live one to the Portal; on account deletion cancel every subscription that hasn't ended.

### M2. Every `auth()` call reads the user row; about five reads per page
`src/auth.ts:98-112`, `src/lib/session.ts:8-12`, `src/lib/db/user.ts:26-35`, `src/lib/db/editor-preferences.ts:16-25`, `src/lib/usage-limits.ts:29-38`
The `jwt` callback looks up `isPro` on each call and `auth()` isn't request-cached, so the shell reads the same row five times.
**Fix:** a request-`cache()`d `getSession()` used by every reader; fold editor preferences into the shell's user read.

### M3. Free-tier limits can be exceeded with concurrent creates
`src/lib/usage-limits.ts:42-65`, `src/actions/items.ts:72-79`, `src/actions/collections.ts:71-74`
The count and the create are separate statements, so five parallel creates at 2 collections all see 2 and insert.
**Fix:** count and create in one serializable transaction.

### M4. The image gallery downloads each full-size original as its thumbnail
`src/components/items/ImageCard.tsx:29-33`, `src/app/api/items/[id]/file/route.ts:26-58`
21 cards of 5 MB screenshots is up to 105 MB and 63 server lookups per page.
**Fix:** generate a small WebP thumbnail at upload and serve it with `?thumb=1`.

### M5. The files page loads and re-sends every file and folder on each folder click _(previously reported)_
`src/lib/db/items.ts:313-329`, `src/app/(app)/items/[type]/page.tsx:85-89,150`
**Fix:** query only the open folder's files, take folder counts from a `groupBy`, and run the Type / Uploaded filters on the server from search params.

### M6. The sign-in limit is keyed by IP plus email, so rotating IPs gives unlimited guesses at one account _(previously reported)_
`src/auth.ts:44-48`, `src/lib/rate-limit.ts:90-93`
**Fix:** add a per-email rule beside the IP + email one.

### M7. `changePassword` allows unlimited guesses at the current password _(previously reported)_
`src/actions/profile.ts:51-58`
**Fix:** rate-limit it per user before `verifyPassword`.

### M8. A password reset or change leaves every existing session signed in _(previously reported)_
`src/lib/password-reset.ts:67-75`, `src/actions/profile.ts:60-63`
**Fix:** a `sessionVersion` column bumped by both writes and checked in the `jwt` callback.

### M9. The register endpoint reveals which emails have accounts _(previously reported)_
`src/app/api/auth/register/route.ts:46-49`
**Fix:** while verification is on, answer an existing email with the same 201 and email the address a notice.

## Low

1. **Settings Checkout cancel lands on `/upgrade`; the settings `?checkout=canceled` and `?plan=` handling can't run** (`src/actions/billing.ts:53`, `src/app/settings/page.tsx`, `BillingCard.tsx`). Fix: one upgrade path.
2. **Sidebar and top bar stay on Free after an upgrade until a full reload** (`SidebarNav.tsx:201`, `(app)/layout.tsx`). Fix: refresh `/settings` until the subscription lands.
3. **The Stripe webhook buffers a body of any size before checking the signature** (`api/webhooks/stripe/route.ts:19-30`). Fix: a byte-capped reader and a 413.
4. **A missing webhook secret is reported as an invalid signature** (same file). Fix: read the secret first and answer 500 with a configuration error.
5. **Free accounts can create folders they can't use** (`src/actions/folders.ts:60-91`). Fix: `createFolder` requires Pro access.
6. **Deleting an account can cancel the subscription and then fail to delete** (`src/actions/profile.ts:131-156`). Fix: on failure, record the cancel and say so.
7. **The shared demo account's password and billing can be changed by anyone signed in as it** (`src/actions/profile.ts:27-63`, billing actions). Fix: refuse those for `DEMO_USER_EMAIL`.
8. **The collection page loads the collection and its items one after the other** (`collections/[id]/page.tsx:52-58`). Fix: `Promise.all`.
9. **Plan data lives in the homepage copy module** (`src/lib/homepage.ts:179-218`). Fix: move it to `src/lib/plans.ts`.
10. **`src/lib/db/items.ts` (716 lines) holds lists, search, detail and writes**. Fix: split into reads, writes and search.
11. **A reset link can be used twice at once** _(previously reported)_ (`src/lib/password-reset.ts:57-75`). Fix: delete the token first and treat no row as invalid.
12. **Timing and wording reveal accounts** _(previously reported)_ (`src/auth.ts:62-65`, `src/actions/auth.ts:124-131`). Fix: a dummy bcrypt compare; the plain reply in the cooldown case.
13. **No length limits on title, description, content or tags** _(previously reported)_ (`src/lib/item-schemas.ts:64-69`).
14. **No `Cache-Control` on `GET /api/items/[id]`** _(previously reported)_.
15. **A double-click on a card closes the drawer it just opened** _(previously reported)_ (`ItemDrawerProvider.tsx:57`).
16. **A dropped connection during a server action throws into the error boundary** _(previously reported)_ (edit form, New Item, collection form, Move dialog, editor preferences and other dialogs).
17. **`discardStoredFiles` sends every R2 delete at once** _(previously reported)_ (`src/lib/stored-files.ts:11`). Fix: chunks of 50.
18. **A chunked upload is buffered whole** _(previously reported)_ (`api/items/upload/route.ts:50-56`). Fix: refuse uploads without `Content-Length`.
19. **Orphaned tags pile up** _(previously reported)_ (item update and delete).
20. **`QuickCopyButton` has no pending state** _(previously reported)_.
21. **The file filter count isn't announced the first time** _(previously reported)_ (`FileList.tsx:103-110`).
22. **The invalid editor ring has no width** _(previously reported)_ (`CodeEditor.tsx:56`, `MarkdownEditor.tsx:60`).
23. **`getTypeCounts` runs twice per dashboard render** _(previously reported)_ (`src/lib/db/collections.ts`).
24. **Uploads have no rate limit or storage quota** _(previously reported)_ (`api/items/upload/route.ts`).
25. **`SidebarNav.tsx` (273 lines) and `prisma/seed.ts` (561 lines) want splitting** _(previously reported)_.

---

**Fix first:** H1, then M1 (it can bill a user twice).
