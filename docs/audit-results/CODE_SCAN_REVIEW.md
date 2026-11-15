# Code Scan Review

**Date:** 2026-11-14
**Run by:** `code-scanner` subagent, whole codebase (`src/`, `prisma/`, `scripts/`, root config)
**Excluded:** `src/generated/prisma/`, `src/components/ui/`, test files, unbuilt features (billing, Pro gate and free-tier limits, AI, custom types, collection editing, search, favorite/pin, export/import), and the interim demo-user scoping of reads
**State at scan:** working tree clean, 473 unit tests passing, `tsc --noEmit` clean. Bundle sizes come from the production build on disk at the time.

**Verified by hand afterwards:** all four Medium findings and Low 1, 2, 5, 6 and 7. The rest are as the scanner reported them.

**Result:** 0 Critical, 0 High, 4 Medium, 9 Low, plus 18 already-tracked items still present.

---

## Critical

None found.

## High

None found.

## Medium

### M1. Inside a folder, the top bar's New Item uploads the file to the top level

`src/components/dashboard/TopBar.tsx:38`, `src/components/items/NewItemDialog.tsx:62,95,159`

**Problem:** On `/items/files?folder=X`, the top bar renders `<NewItemDialog />` with no `folderId`. It pre-selects File from the path (`getCreatableTypeFromPath(pathname)`), but `folderId` defaults to `null`, so the upload sends no folder. The page's own New File button passes `folderId={openFolder?.id ?? null}` (`src/app/(app)/items/[type]/page.tsx:99`).

**Impact:** The user opens folder "Docs", clicks New Item in the top bar (File already selected) and uploads. The toast says "Item created", but "Docs" still reads "This folder is empty". The file went to the top level, and uploading again with New File leaves a duplicate.

**Fix:** Infer the folder the same way the dialog infers the type, only when no prop is passed:

```tsx
// prop becomes `folderId?: string | null` with no default
const searchParams = useSearchParams();
const targetFolderId =
  folderId !== undefined ? folderId
  : getCreatableTypeFromPath(pathname) === "file" ? searchParams.get("folder")
  : null;
```

The upload route already answers 404 for a folder that isn't the user's, so a stale value fails safely.

### M2. Every app page downloads all of Zod (about 90 KB gzip) for one string helper and one number

`src/components/items/ItemFormFields.tsx:9`, `src/components/items/FolderNameDialog.tsx:18`

**Problem:** Two client files import plain values from modules that build Zod schemas when they load:

- `ItemFormFields` imports `parseTagInput`, a 5-line string splitter, from `src/lib/item-schemas.ts:105-112`.
- `FolderNameDialog` imports `FOLDER_NAME_MAX_LENGTH` from `src/lib/folder-schemas.ts:3`.

`ItemFormFields` is rendered by `NewItemDialog` (top bar) and `ItemDrawerEditForm` (drawer), and `(app)/layout.tsx` mounts both.

**Impact:** The `(app)/layout` client entry includes a chunk of 392,191 B raw / 90,099 B gzip that is Zod's whole `z` namespace, every locale included. Another chunk in the same entry rebuilds `updateItemSchema` and `folderNameSchema` client-side. `/dashboard` and every `/items/*` page pay this on a cold load. `/items/[type]` ships 917 KB raw / 257 KB gzip of JS in total, so Zod is about 35% of it.

**Fix:** Move the two values into modules without Zod:

```ts
// src/lib/tags.ts (no zod): ItemFormFields imports from here
export function parseTagInput(input: string): string[] { /* moved from item-schemas.ts */ }
// src/lib/folders.ts (already zod-free): folder-schemas.ts and FolderNameDialog import it
export const FOLDER_NAME_MAX_LENGTH = 100;
```

After `npm run build`, confirm Zod is gone from the dashboard's client reference manifest. It should remain only on `/register`, which validates with `registerSchema` on purpose.

### M3. The maintenance scripts delete file items but leave their R2 objects and reset tokens behind

`scripts/reset-users.ts:126-133`, `prisma/seed.ts:420-421`

**Problem:** Both scripts predate uploads and folders.

- `db:reset-users --confirm` deletes every non-demo user's items without collecting their `fileUrl` keys.
- It deletes tokens only where `identifier` is the bare email, so `password-reset:<email>` rows survive.
- Its dry run counts neither folders (removed by cascade) nor stored files.
- `db:seed`'s `clearDemoData` deletes all of the demo user's items, UI uploads included, and never touches R2.

The app's own delete paths (`deleteItem`, `deleteFolder`, `deleteAccount`) all call `discardStoredFiles()`.

**Impact:** Reseeding orphans every file the demo account uploaded; at the time of the scan that was the "Naveen Resume" PDF and the "Docker Network" image. Resetting users orphans every upload by every deleted user. No row points at those objects afterwards, so nothing will ever delete them. A deleted user's reset token stays in `verification_tokens` until it expires.

**Don't run `npm run db:seed` until this is fixed.**

**Fix:**

- In both scripts: read the keys, run the delete transaction, then call `discardStoredFiles(keys)`, imported lazily like `@/lib/prisma`.
- In `reset-users`: delete tokens for `emails.flatMap((e) => [e, resetIdentifier(e)])`, and count folders and files in the dry run.
- In the seed: either discard the keys too, or scope the clear to `contentType: { not: "file" }`, since the seed creates no file items.

### M4. The files page reloads and resends every file and folder on each folder click

`src/app/(app)/items/[type]/page.tsx:57-60,113`, `src/lib/db/items.ts:131-153`, `src/components/items/OpenItemButton.tsx:8`

**Problem:**

- `getItemsByType` has no cap and selects the full card payload, including description, tags and file fields. Its comment justifies the missing cap with the 50-item free tier, which isn't enforced, and Pro is unlimited.
- On `/items/files`, the page passes every file in every folder, plus every folder, into the client `FileList`, which filters to the open folder in the browser.
- `?folder=` is a search param, so each folder click re-renders the page: both queries run again and both full lists are serialized again.
- `FileRow` never renders `description` or `tags`.
- On card pages, every `ItemCard` and `ImageCard` passes its whole `ItemSummary` to the client `OpenItemButton`. The drawer reads only `id`, `title`, `typeName`, `isPinned` and `isFavorite`.

This came from a deliberate File Folders design (the list derives everything from data the page already loads), so it is a scaling trade-off rather than a bug.

**Impact:** With a few thousand files across a few hundred folders, opening a folder that holds three files still queries, serializes and transfers all of them, with descriptions that have no maximum length.

**Fix,** cheapest first:

1. Type `OpenItemButton`'s prop as `Pick<ItemSummary, "id" | "title" | "typeName" | "isPinned" | "isFavorite">` and pass only those fields.
2. Give the files page its own select without `description` and `tags`.
3. Load only the open folder's files (`where: { userId, itemTypeId, folderId }`), get per-folder counts from `item.groupBy({ by: ["folderId"] })` plus the folder list, and run the Type and Uploaded filters on the server from search params.

## Low

### L1. Editing a link can save it with no URL, which creating one forbids

`src/lib/item-schemas.ts:48`, `src/lib/db/items.ts:372`

**Problem:** `createItemSchema` requires a URL for links. `updateItemSchema.url` is optional, and `updateItem` writes `url: data.url` for link items.

**Impact:** Open a link, choose Edit, clear the URL and save. The toast says "Item saved", and the row keeps `contentType: "url"` with `url: null`. The drawer's URL section disappears, and the card's copy button shows "This item has nothing to copy."

**Fix:** After `updateItem` loads the item's type, reject `fields.url && !data.url` as a `url` field error, mapped to `fieldErrors` by the action. Share one `requiresUrl(typeName)` check with `createItemSchema`.

### L2. The public register endpoint reads a body of any size before validating it

`src/app/api/auth/register/route.ts:20-25`

**Problem:** `request.json()` reads the whole body with no size check. Route handlers have no default body limit, the proxy doesn't match `/api`, and the rate limiter runs only after parsing and validation.

**Impact:** When self-hosted with no body limit in front (Vercel caps request bodies at 4.5 MB), an unauthenticated POST of a few hundred MB is fully buffered and parsed. A handful in parallel can exhaust memory, and none count against the limiter.

**Fix:** Refuse oversized bodies before reading, as the upload route does: `if (Number(request.headers.get("content-length")) > 16_384) return errorResponse("Request body is too large", 413);`. To cover chunked bodies, read `request.body` with a byte cap.

### L3. Deleting an account can leave an in-flight upload's file in R2

`src/actions/profile.ts:110-126`

**Problem:** `getUserFileKeys()` runs before the transaction, while `item.deleteMany({ where: { userId } })` deletes by owner. `deleteFolderTree` was written specifically to avoid this gap.

**Impact:** If an upload's row commits between the key read and the transaction, the row is deleted but its key was never collected, so the file stays in the bucket for good.

**Fix:** Every key starts with `userId + "/"` (`buildFileKey`). After the transaction, delete by that prefix with a new `r2.ts` helper using `ListObjectsV2` and `DeleteObjects`.

### L4. No index fits the per-type list or the sidebar's per-type counts

`prisma/schema.prisma:115-118`

**Problem:** `getItemsByType` filters `{ userId, itemTypeId }` newest first, and `countItemsByType` runs a `groupBy` on `itemTypeId` per `userId` on every app-shell render, including every `router.refresh()`. The indexes that lead with `userId` don't include `itemTypeId`, and `items_itemTypeId_idx` covers every user's rows of a shared system type.

**Impact:** For a user with 5,000 items, 40 of them links, `/items/links` walks all 5,000 of that user's rows (or every user's links if the planner picks the type index). The sidebar count makes the same walk on each render.

**Fix:** Add `@@index([userId, itemTypeId, createdAt(sort: Desc), id(sort: Desc)])` through `npm run db:migrate`. Keep `@@index([itemTypeId])` for the foreign key.

### L5. The "not signed in" message has drifted

`src/actions/profile.ts:28,97`

**Problem:** With no session, `changePassword` and `deleteAccount` answer "You are not signed in.", while every other action and route says "Your session has expired. Sign in again."

**Fix:** Share one constant (see L8).

### L6. Hand-built plurals print "1 items" and "1 of 1 files"

`src/components/dashboard/CollectionCard.tsx:43`, `src/components/items/FileList.tsx:167`, `src/app/(app)/items/[type]/page.tsx:92`

**Problem:** Three places build plurals by hand instead of calling `formatCount()` (`src/lib/format.ts:39-41`).

**Impact:** A collection with one item reads "1 items". With a single file and a filter on, the status line reads "1 of 1 files".

**Fix:** `formatCount(collection.itemCount, "item")`, `` `${shownFiles.length} of ${formatCount(items.length, "file")}` ``, and `formatCount` in the page header.

### L7. The profile page waits for the user row before starting the stats queries

`src/app/profile/page.tsx:26,34`

**Problem:** `getProfileStats(user.id)` starts only after `getProfileUser()` resolves, but it needs only the session id.

**Impact:** One extra serial database round trip on every `/profile` load.

**Fix:** Read `const session = await auth();` first, then `Promise.all([getProfileUser(), getProfileStats(session.user.id)])`, keeping the redirect when the user is null.

### L8. Repeated client and server plumbing

`src/hooks/use-item-detail.ts:33-46`, `src/lib/item-copy.ts:17-31`, `src/lib/auth-schemas.ts:61-70`

**Problem:**

- `useItemDetail.load` and `fetchItemCopyText` each build the `GET /api/items/[id]` request with `cache: "no-store"`, cast the JSON to `ItemDetailResponse`, and define their own "Couldn't load this item. Please try again." (also the route's 500 message).
- The generic `FieldErrors` and `getFieldErrors` live in the auth schema module, yet the item and folder actions, the upload route and `src/types/` import them from there.
- The session check is a private `getSessionUserId()` in `actions/folders.ts` and is copied inline in `actions/items.ts` (3 times), `actions/profile.ts` (2 times) and the three item routes.
- Four routes each define the same `errorResponse()`.
- Not-found messages are duplicated between `actions/items.ts:20` and `api/items/[id]/route.ts:6`, and between `folder-schemas.ts:7` and `api/items/[id]/file/route.ts:11`.

**Impact:** Changes to the endpoint contract or error copy have to be made in several places, and the copies have already drifted (L5).

**Fix:**

- `src/lib/` gains one `fetchItemDetail(id, { signal })` returning `{ ok: true, item } | { ok: false, message }`.
- `src/lib/session.ts` for `getSessionUserId()`.
- `src/lib/action-result.ts` for `FieldErrors`, `getFieldErrors`, the failure builders and the shared not-found and session messages.
- `src/lib/api-response.ts` for `errorResponse()`.
- `auth-schemas.ts` keeps only the auth schemas.

### L9. `FileList.tsx` and `NewItemDialog.tsx` each hold logic that belongs in other files

`src/components/items/FileList.tsx` (309 lines), `src/components/items/NewItemDialog.tsx` (268 lines)

**Problem:**

- `FileList.tsx` mixes deriving the view (filter state, sort, the reset on folder change, the visible lists), running three dialogs, and a generic `FilterSelect` chip.
- `NewItemDialog.tsx` contains `uploadFileItem()` (FormData, the XHR call and error mapping), request code that can't be unit tested inside a component file.

**Fix:**

- From `FileList.tsx`, extract `FilterSelect.tsx`, a `useFileListView(items, folders, folderId)` hook, and a `FileRowDialogs` component.
- Move `uploadFileItem()` into `src/lib/upload-request.ts` next to `postFormWithProgress()`.
- Move `NewItemForm` into its own file.

---

## Known, already tracked

Still present, and already recorded in the History in `context/current-feature.md` or in `AUTH_SECURITY_REVIEW.md`:

- A double-click on a card closes the drawer it just opened (`ItemDrawerProvider.tsx:57`).
- No `Cache-Control` on `GET /api/items/[id]` (`src/app/api/items/[id]/route.ts:38`).
- "Your session has expired. Sign in again." is copied in five files.
- The can't-close-while-pending guard is repeated in five dialogs.
- `ImageCard.tsx:40-71` duplicates `ItemCard`'s title row and tag list.
- A server-action network failure throws into the error boundary (e.g. `ItemDrawerEditForm.tsx:58`, `MoveToDialog.tsx:123`).
- Orphaned tags aren't cleaned up (`db/items.ts:373`, and on delete).
- `discardStoredFiles()` sends every delete at once (`stored-files.ts:10`).
- A chunked upload without `Content-Length` skips the early 413 (`upload/route.ts:38`).
- `FileList`'s `role="status"` count doesn't announce its first change (`FileList.tsx:166`).
- The invalid ring has no width (`CodeEditor.tsx:55`, `MarkdownEditor.tsx:60`).
- `x-forwarded-for` is trusted as sent (`rate-limit.ts:90-93`).
- From `AUTH_SECURITY_REVIEW.md`:
  - no limit on `changePassword`'s current-password check (`profile.ts:49`);
  - register's 409 reveals which emails exist (`register/route.ts:45-47`);
  - sessions survive a reset or password change (`password-reset.ts:66-74`, `profile.ts:58-61`);
  - timing and cooldown differences reveal accounts (`auth.ts:63-65`, `actions/auth.ts:128-136`);
  - one reset link can be submitted twice at once (`password-reset.ts:57-74`).
- `getTypeCounts()` runs in both the sidebar and the dashboard, 14 grouped queries per dashboard render (`collections.ts:156,207`).
- No length limits on title, description or tags (`item-schemas.ts:44-49`).
- `QuickCopyButton` has no pending state, so repeated clicks start parallel fetches (`QuickCopyButton.tsx:27`).
- Uploads have no rate limit or storage quota.
- The link-URL refinement runs only once the other fields pass (`item-schemas.ts:68`).
- `SidebarNav.tsx` (262 lines) and `prisma/seed.ts` still need splitting.

## Recommended order

1. **M1**: a bug users will hit.
2. **M2**: two import moves for about 90 KB gzip off every app page.
3. **M3**: before the next `npm run db:seed`.
