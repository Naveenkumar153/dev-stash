# Current Feature

<!-- Feature Name -->

Dashboard Collections — Real Data from Neon via Prisma

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

Replace the dummy collection data in the dashboard's main area with real rows from the Neon database via Prisma. The layout stays exactly as it looks today — the same grid of 6 recent collection cards — only the data source changes.

- Create `src/lib/db/collections.ts` holding the collection data-fetching functions (Prisma queries), replacing the mock-backed collection helpers in `src/lib/dashboard.ts`.
- Fetch collections directly in the `/dashboard` server component (no API route, no server action — server components fetch with Prisma per the coding standards).
- Keep deriving each card's left border color from the item type the collection holds most of, now computed from real `ItemCollection` → `Item` → `ItemType` rows instead of mock arrays.
- Keep showing the small icons for every distinct item type present in the collection, in item type order.
- Update the stats cards so the counts (items, collections, favorite items, favorite collections) come from the database.
- Keep the current design intact — `CollectionCard` and the grid markup should not need visual changes.
- Do **not** wire the pinned/recent item lists to the database yet; items under collections are a later feature.
- `npm run build` and `npm run lint` pass, and `/dashboard` renders the seeded collections in the browser.

## Notes

- Requirements source: `context/features/dashboard-collections-spec.md`. Design reference: `context/screenshots/dashboard-ui-main.png`.
- The seeded demo user (`demo@devstash.io`) owns all the seeded collections. There is no auth yet, so the dashboard needs a temporary way to resolve the current user — resolve the demo user by email until NextAuth lands, and keep it in one place so it is easy to swap.
- **Known mismatch to resolve:** `getItemTypeStyle()` / `getItemTypeName()` in `src/lib/item-types.ts` key off the mock ids (`type-snippet`, `type-prompt`, …), but real `ItemType` rows use cuids. The styling lookup has to move to something stable across both — the type `name` (or a slug of it) — or the cards will all fall back to the neutral border. Tailwind must still see every literal class name.
- The sidebar (`getItemTypeNav()`) and the pinned/recent item sections still read from `src/lib/mock-data.ts`. That is expected for this feature; leave them until their own features. Do not delete `mock-data.ts` yet.
- Watch the query shape: fetching collections and then counting types per collection is an easy N+1. Pull the item types per collection in one query (include the join rows, or group by) rather than a query per card.
- Collection `createdAt` is a `DateTime` in the database, while `formatShortDate()` in `src/lib/dashboard.ts` takes a `"YYYY-MM-DD"` string. Sorting and formatting need to handle real `Date` objects without shifting a day between server and browser.
- Empty collections keep the existing neutral-border fallback and show no type icons.
- **Hard constraint (unchanged):** never `prisma db push`, never edit the database structure by hand. This feature is read-only against the existing schema — no migration expected.

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
