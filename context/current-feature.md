# Current Feature

<!-- Feature Name -->

Seed Data — Demo User, System Item Types, Collections & Items

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Add a seed script at `prisma/seed.ts` that populates the development database with realistic sample data, so the dashboard can be built against real rows instead of mock data.

- Add `bcryptjs` and register the seed command in `prisma.config.ts` (Prisma 7 moved seed config out of `package.json`), plus an `npm run db:seed` script.
- Seed one demo user: `demo@devstash.io`, name "Demo User", password `12345678` hashed with bcryptjs at 12 rounds, `isPro: false`, `emailVerified` set to the current date.
- Seed the 7 system item types with `isSystem: true` and no owner, using the exact icons and colors from the spec: snippet/`Code`/`#3b82f6`, prompt/`Sparkles`/`#8b5cf6`, command/`Terminal`/`#f97316`, note/`StickyNote`/`#fde047`, file/`File`/`#6b7280`, image/`Image`/`#ec4899`, link/`Link`/`#10b981`.
- Seed 5 collections owned by the demo user, each with the description from the spec, and 18 items linked through the `ItemCollection` join table:
  - **React Patterns** — 3 TypeScript snippets (custom hooks, component patterns, utility functions)
  - **AI Workflows** — 3 prompts (code review, documentation generation, refactoring)
  - **DevOps** — 1 snippet (Docker / CI-CD config), 1 command (deployment script), 2 links
  - **Terminal Commands** — 4 commands (git, docker, process management, package manager)
  - **Design Resources** — 4 links
- Set `contentType` correctly per item — `text` for snippets, prompts, commands and notes; `url` for links — and set `language` on code snippets.
- Use real, working URLs for every link item.
- Make the script idempotent so it can be re-run without duplicating rows or failing.
- `npm run db:seed` succeeds, `npm run db:test` still reports healthy, and `npm run build` passes.

## Notes

<!-- Any extra notes -->

- Requirements source: `context/features/seed-spec.md`.
- **Hard constraint (unchanged):** never `prisma db push`, never edit the database structure by hand. This feature adds data only — no schema changes, so no new migration is expected.
- Prisma 7 detail: the seed command is configured in `prisma.config.ts` under `migrations.seed`, not via the `prisma.seed` key in `package.json` (that is the Prisma 5/6 convention).
- **Known constraint to work around:** `ItemType` has `@@unique([userId, name])`, but system types have `userId = null` and Postgres treats `NULL != NULL`, so that constraint does *not* prevent duplicate system types. A plain `upsert` on `userId_name` cannot be relied on for them — idempotency needs a find-then-create, or a clear-and-reseed of the demo data.
- Item type colors and icons must stay in sync with the table in `context/project-overview.md`; the icons are lucide-react component names.
- Tags are out of scope — the spec does not assign any, so no `Tag` rows are seeded.
- The seed targets the Neon **development** branch only; it must never be pointed at production.
- The dashboard currently reads from `src/lib/mock-data.ts`; swapping the UI over to real queries is a separate feature, not this one.

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
