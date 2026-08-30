# Current Feature

Audit Quick Wins

## Status

In Progress — implemented and verified on `feature/audit-quick-wins`, pending commit

## Goals

Six low-risk fixes from the codebase audit. No new dependency and no design
change — the rendered dashboard should be identical before and after. Five items
are contained to a function body or a single call site; the sixth is an
index-only migration, additive and reversible.

### 1. Collection summaries stop loading every join row (the N+1)

`src/lib/db/collections.ts:32` — `COLLECTION_SUMMARY_SELECT` pulls a
collection's entire `items` relation, one `ItemCollection` row joined through
`items` to `item_types` per member item and unbounded, purely so `summarize()`
(line 46) can compute `items.length` and tally type names. The select is shared
by `getRecentCollections()` (6 collections) and `getSidebarCollections()` (up to
10 across favorites and recent), and the dashboard page and layout both run on
the same request — so a user with 16 collections averaging 2,000 items each
moves ~32,000 rows to produce 16 integers and a handful of type names. This is
the shape the `src/lib/db/` convention (one `findMany` plus a `groupBy`, joined
in memory) exists to avoid.

Replace it with aggregation the database performs, using only the Prisma Client
query API — no raw SQL:

- `_count: { select: { items: true } }` on the collection select, for
  `itemCount`.
- `getAvailableTypes()` — the system types plus the user's own — fetched in the
  same `Promise.all` as the collections, so it costs no extra stage. It lives in
  the new `src/lib/db/item-types.ts` and is wrapped in React `cache()` like
  `getCurrentUserId()`: the dashboard asks for this list three times per request
  (sidebar type counts, sidebar collections, main-area collections), and the
  cache collapses them into one query. `getItemTypeCounts()` was moved onto it
  too, replacing the copy of the query it held.
- `getTypeCounts()` — one `itemCollection.groupBy({ by: ["collectionId"] })` per
  item type, filtered by `item: { itemTypeId }`, all issued together in a
  `Promise.all` and folded into a `Map<collectionId, Map<typeName, count>>`
  that `summarize()` reads.

`groupBy` only groups on a model's own scalar fields, and `ItemCollection` has
just `itemId` / `collectionId` / `addedAt`, so the type split cannot come from
the grouping key — it comes from the filter instead, one query per type. That
trades row volume for query count, which is the right way round here: types are
a small fixed set (7 system types, custom types Pro-only and unbuilt), while
items per collection grows without limit. Rows returned become
`collections × types` regardless of collection size, and the queries are
independent so they cost roughly one round trip.

The alternatives were `$queryRaw` (one query, but hand-written SQL that is not
checked against the schema) and Prisma TypedSQL (one query, type-safe, but still
a `.sql` file and it adds `--sql` to the generate step). Both were rejected in
favour of staying inside the Prisma Client API. The accepted cost: query count
scales with the number of item types, so this wants revisiting if custom types
ever arrive in bulk.

`summarize()` keeps its existing rules — item type order, stable sort, most
common type first, `null` when empty — and `CollectionSummary` is unchanged, so
`CollectionCard` and `SidebarNav` need no edit.

### 2. `getPinnedItems()` gets a row bound

`src/lib/db/items.ts:50` — every other list query takes a bound
(`getRecentItems` at 10, collections at 6 and 5), but the pinned query has no
`take`, and it is the one query whose result size the user directly controls. A
user who pins 500 items selects 500 rows plus their tags and serializes 500
`ItemCard`s into the RSC payload above the Recent section. Add a
`PINNED_ITEM_LIMIT = 10` and a `limit` parameter, matching `getRecentItems()`.

### 3. Stats stop costing a second round trip

`src/app/dashboard/page.tsx:59` — React awaits the async `DashboardPage` in full
before it can see the returned JSX, so `<StatsCards />` (which awaits
`getDashboardStats()` at `StatsCards.tsx:26`) does not start until the page's
`Promise.all` has settled. The four counts are parallel with each other but
serial with everything else, adding a full Neon round trip to TTFB for data that
depends on nothing.

Hoist `getDashboardStats()` into the page's existing `Promise.all` and pass the
result down as a `stats` prop, making `StatsCards` a synchronous presentational
component. Suspense would stream the shell earlier but would not remove the
serial start.

### 4. `checkTables()` runs its nine counts in parallel

`scripts/test-db.ts:68` — nine `count()` calls awaited one at a time inside an
object literal, each a full Neon serverless request. They are independent;
`Promise.all` over the nine, destructured back into the same `counts` object,
keeps the output identical.

### 5. The seed script refuses to run against production

`prisma/seed.ts:481` — `main()` runs unconditionally. It upserts
`demo@devstash.io` with a bcrypt hash of `12345678` and `emailVerified` set,
then `deleteMany`s that user's items and collections. Nothing inspects
`NODE_ENV` or the connection string; the line-11 docstring is the only guard,
and a `.env.production` sits in the working tree. One mistargeted
`npm run db:seed` plants a verified account with a known password — inert today
with no login route, a live credential the moment NextAuth's credentials
provider lands.

Throw at the top of `main()` when `NODE_ENV === "production"`, with an explicit
`ALLOW_SEED=true` escape hatch, and log the target database host before writing
so a mistargeted run is visible in the output. The host comes from `new URL()`
rather than a regex, so a password containing `@` cannot make the log point at
the wrong place, and only the host is printed — never the credentials.

An unconditional `ALLOW_SEED` requirement was considered and rejected: the seed
command is registered in `prisma.config.ts` under `migrations.seed`, so Prisma
runs it as part of `prisma migrate dev`, and gating it on a variable nobody sets
would break `npm run db:migrate`.

### 6. Composite indexes for the list queries, as a migration

`prisma/schema.prisma:104` and `:127` — `Item` and `Collection` each carry a
single-column `@@index([userId])`, but every list query filters on `userId` and
orders on `createdAt`, and `getPinnedItems()` adds an `isPinned` predicate no
index mentions. Postgres finds the user's rows through `items_userId_idx` and
then sorts all of them to satisfy the `ORDER BY` before applying `LIMIT` — a
50,000-row sort to return ten cards. Fine at 18 seeded rows, sharp degradation
with real data.

```prisma
// Item — replaces @@index([userId])
@@index([userId, createdAt(sort: Desc), id(sort: Desc)])
@@index([userId, isPinned, createdAt(sort: Desc), id(sort: Desc)])

// Collection — replaces @@index([userId])
@@index([userId, createdAt(sort: Desc)])
@@index([userId, isFavorite, createdAt(sort: Desc)])
```

Each composite leads with `userId`, so it also serves the plain
`where: { userId }` lookups in `stats.ts` and `getItemTypeCounts()` and the
standalone `@@index([userId])` can go. `@@index([itemTypeId])` on `Item` and
`@@index([defaultTypeId])` on `Collection` stay — they back the foreign keys.

Ship it through `npm run db:migrate` (`prisma migrate dev`) so the SQL lands in
`prisma/migrations/` and both database branches move through the same file:
dev applies it on creation, prod through `npm run db:deploy`
(`prisma migrate deploy`) at release. Never `prisma db push`, and never touch
the database structure by hand — the two branches have to stay in sync, and the
migration file is the only thing that guarantees it. `npm run db:status` must
report in-sync before the commit.

## Notes

**Risk.** Items 2–5 are additive or mechanical. Item 6 changes the schema, but
only indexes — no column added, dropped or retyped, so no data is rewritten and
the migration is reversible by another migration. Item 1 stays inside the typed
query API, so it carries no runtime type risk; its cost is the extra round trips
described above.

**Verification (done).** `summarize()` is pure, so both paths were run against
the seeded database and compared: old join-row summaries vs. new aggregation,
for all three query shapes (recent 6, sidebar favorites, sidebar non-favorites).
Output was byte-identical, including the mixed-type collection that exercises
the ordering and tie-break (`types=[snippet, command, link]`, `dominant=link`).
The rendered `/dashboard` then showed the same values — stats 18 / 5 / 0 / 2 and
cards at 4, 4, 4, 3, 3. `npm run lint`, `npm run build`, `npm run db:status`
(in sync) and `npm run db:test` (2 migrations, 9 tables, healthy) all pass. The
seed guard was checked both ways: `NODE_ENV=production` refuses, a normal dev
run seeds and logs its target host.

**Verification (item 6).** `npm run db:migrate` to create and apply the
migration, `npm run db:status` to confirm dev is in sync, and the checked-in
`migration.sql` reviewed by eye before the commit — it should contain only
`DROP INDEX` / `CREATE INDEX` statements. Prod picks the same file up through
`npm run db:deploy` on the next release.

**Deliberately out of scope.**

- *Per-user tag scoping.* `Tag.name` is globally unique, so every user's `react`
  tag is one shared row. Needs a migration and settles an open question in the
  spec appendix.
- *Deleting `src/lib/mock-data.ts`.* 227 lines, only `currentUser` still
  imported (by `SidebarUser`), which is why the sidebar footer shows "John Doe".
  Deleting a file needs sign-off, and the real fix is the layout passing the
  user down — which is the NextAuth feature.
- *The `/items/:x` segment conflict.* `getItemTypeHref()` builds
  `/items/snippets` while `ItemCard` links to `/items/[id]`; whichever page is
  written first claims the segment. Neither route exists yet, and picking the
  namespace is a design decision, not a quick win.
- *`SidebarNav.tsx` and `prisma/seed.ts` decomposition.* Both are oversized
  (262 and 504 lines), but neither has a defect behind it.
- *Parallelizing the seed's per-item creates.* Tempting alongside item 4, but
  the items in a collection share tags and attach them with
  `connectOrCreate` against a globally unique `Tag.name`, so concurrent creates
  would race on the unique constraint. The loop stays sequential.

## History

<!-- Keep this updated. Earliest to latest -->

- Initial setup of Next.js
- Project setup and boilerplate cleanup
- Dashboard UI Phase 1: shadcn/ui init, /dashboard route, top bar (search + New Item), dark mode by default, Sidebar/Main placeholders
- Dashboard UI Phase 1 (rebuild): sidebar as a full-height column with the top bar inside the content column, New Collection button added to the top bar, Geist font variables wired into the theme, item type colors added as global tokens, real DevStash metadata
- Dashboard UI Phase 2: real sidebar replacing the placeholder - collapsible desktop column with an icon rail, mobile drawer, top bar toggle, item types linking to /items/TYPE, favorite and recent collections, user avatar area, shadcn avatar/separator/sheet/tooltip added
- Dashboard UI Phase 3: main content area - 4 stats cards, recent collections as cards color-coded by their dominant item type, pinned items, 10 recent items, per-type styling shared through getItemTypeStyle(), shadcn card/badge added
- Database Foundation: Prisma 7 (`prisma-client` generator, `src/generated/prisma`, `prisma.config.ts`) against Neon PostgreSQL via the `@prisma/adapter-neon` driver adapter, initial schema (User, ItemType, Item, Collection, ItemCollection, Tag, ContentType) plus NextAuth v5 models, FK indexes and cascade deletes, `src/lib/prisma.ts` singleton, first migration `20260829101324_init`, and `npm run db:test` connectivity check
- Seed Data: `prisma/seed.ts` run via `npm run db:seed` (seed command registered in `prisma.config.ts` under `migrations.seed`, the Prisma 7 location), seeding the demo user `demo@devstash.io` with a bcryptjs 12-round hash, the 7 system item types, and 5 collections holding 18 items linked through `ItemCollection`; idempotent via find-then-create for system types (the `@@unique([userId, name])` constraint does not dedupe NULL owners) plus a clear-and-reseed of the demo user's own rows; `npm run db:test` extended to read back and display the seeded data
- Dashboard Collections: the dashboard's collection cards and stats now read real rows from Neon via Prisma — `src/lib/db/user.ts` (`getCurrentUserId()`, resolving the seeded demo account by email until NextAuth lands), `src/lib/db/collections.ts` (`getRecentCollections()`, one `findMany` that loads the 6 newest collections with their join rows' item type names and derives itemCount / dominantTypeName / typeNames in memory, no per-card query) and `src/lib/db/stats.ts` (four counts in a `Promise.all`); both entry points `await connection()` so the queries stay out of the build-time prerender and `/dashboard` builds as a dynamic route; `getItemTypeStyle()` re-keyed from mock ids to type names via the new `getItemTypeStyleByName()` / `getItemTypeLabel()` / `ITEM_TYPE_ORDER` so cuid-backed rows style correctly while the still-mock ItemCard and sidebar keep working; `CollectionCard` switched to type names, `StatsCards` made async, an empty state added for collections, and `src/lib/dashboard.ts` trimmed to the mock item helpers. Design unchanged; item lists and the sidebar stay on mock data for a later feature
- Dashboard Items: the dashboard's pinned and recent lists now read real rows from Neon via Prisma — `src/lib/db/items.ts` (`getPinnedItems()` and `getRecentItems(limit = 10)`, sharing one card-sized `select` that skips content and file payloads and pulls the item type name plus tags, ordered `createdAt desc, id desc` for a stable tie-break, both `await connection()` like the collection queries), with the page loading collections, pinned and recent in one `Promise.all`; `ItemCard` re-typed from the mock `Item` to `ItemSummary` and styled through `getItemTypeStyleByName()` / `getItemTypeLabel()`; `ItemSection`'s `emptyMessage` made optional so the Pinned section disappears entirely when nothing is pinned; `formatShortDate()` moved to `src/lib/format.ts` taking a real `Date` (still formatted in UTC, with the full ISO string on `<time dateTime>`) and the leftover `src/lib/dashboard.ts` deleted; `prisma/seed.ts` extended to tag all 18 items via `connectOrCreate` (data only, no migration) so the badge row matches the design. Design unchanged; only the sidebar and `SidebarUser` still read mock data
- Dashboard Stats & Sidebar: the sidebar now reads real rows from Neon via Prisma — `getItemTypeCounts()` added to `src/lib/db/items.ts` (system types plus any user-owned custom ones, counted with an `itemType.findMany` and an `item.groupBy` in a `Promise.all` and joined in memory, so the list is two queries rather than one count per type, and an unseeded database still lists every type at zero) and `getSidebarCollections()` added to `src/lib/db/collections.ts` (favorites and the newest non-favorites, capped at 5 each, sharing the new `COLLECTION_SUMMARY_SELECT` with `getRecentCollections()` so both go through `summarize()` and recents carry `dominantTypeName`); `src/app/dashboard/layout.tsx` became async and loads both in one `Promise.all`, passing plain rows down through `Sidebar` → `SidebarBody` → `SidebarNav` so only serializable data crosses into the client and icons/colors resolve from the type name; `SidebarNav` dropped its mock imports, links each type to `/items/[typename]`, keeps the star on favorites, shows a `CollectionDot` colored by the collection's dominant type under Recent, gained a "View all collections" row to `/collections` and per-group empty states; `src/lib/item-types.ts` lost the mock-id helpers (`getItemTypeNav()`, `getItemTypeStyle()`, `getItemTypeName()`) and the `mock-data` import, gained `dotClass` on `ItemTypeStyle` plus `getItemTypeHref()`, `getItemTypePlural()` and a shared `compareItemTypeOrder()` (custom types sort after the system ones) that replaced the private `byTypeOrder` in `collections.ts`; `getCurrentUserId()` wrapped in React `cache()` so the five db modules share one lookup per request. The stats cards were already database-backed and are unchanged; design unchanged; only `SidebarUser` still reads mock data, pending NextAuth
- Add Pro Badge to Sidebar: the `file` and `image` rows in the sidebar's type list now carry a small PRO badge — `PRO_TYPE_NAMES` and `isProItemType()` added to `src/lib/item-types.ts` beside the other name-keyed type metadata (icon, colors, href, plural label) so tier membership is looked up by type name and the sidebar never names `file`/`image` itself, leaving one call site for the New Item menu and item list pages later; `NavRow` in `src/components/dashboard/SidebarNav.tsx` gained an optional `badge` slot rendered after the label and inside the existing `!collapsed` block, so the badge hides with the label and count in the 64px icon rail (the tooltip there still shows only the plural label) and shows in the mobile drawer, which passes `collapsed={false}`; `ProBadge` is the shadcn `Badge` at `variant="outline"` overridden to `h-4 px-1.5 text-[10px] tracking-wide text-muted-foreground`, which tailwind-merge resolves against the CVA base's `h-5 px-2 text-xs` and outline's `text-foreground`, with `PRO` an uppercase literal rather than a CSS transform so the accessible name reads "Files PRO 0". Presentation only: no schema, query or entitlement change — `User.isPro` still has no application code reading it, and the badge marks which types would need Pro rather than gating anything. Verified against the rendered DOM of a running server: the badge appears on exactly those two of the seven type rows
