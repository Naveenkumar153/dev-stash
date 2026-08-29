# Current Feature

<!-- Feature Name -->

Dashboard Items — Pinned & Recent from Neon via Prisma

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

## Notes

<!-- Any extra notes -->

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
