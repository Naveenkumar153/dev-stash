# Current Feature

<!-- Feature Name -->

Add Pro Badge to Sidebar

## Status

<!-- Not Started|In Progress|Completed -->

In Progress

## Goals

<!-- Goals & requirements -->

- The `file` and `image` item types show a PRO badge in the sidebar item type list
- The badge uses the shadcn/ui `Badge` component
- The badge label reads `PRO`, all uppercase
- The badge is clean and subtle — it must not compete with the type label or the item count
- No other item type shows a badge

## Notes

<!-- Any extra notes -->

- Spec: `context/features/add-pro-badge-sidebar.md`
- Reference: http://ui.shadcn.com/docs/components/base/badge
- `Badge` is already installed at `src/components/ui/badge.tsx` — no `shadcn add` needed
- The item type list lives in `src/components/dashboard/SidebarNav.tsx`, which renders rows from the `getItemTypeCounts()` data passed down through `Sidebar` → `SidebarBody`
- `file` and `image` are the Pro-tier types per the project spec's tier table; the badge should be driven off type identity, not a hardcoded pair of labels in the markup
- The sidebar collapses to an icon rail and becomes a drawer on mobile — decide how the badge behaves in the collapsed rail (likely hidden, since only the icon shows there)
- Presentation only: no schema, query, or entitlement changes. The badge marks the tier, it does not gate anything

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
