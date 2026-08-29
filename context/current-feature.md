# Current Feature

<!-- Feature Name -->

Database Foundation — Neon PostgreSQL + Prisma 7

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Set up Prisma ORM against a Neon (serverless) PostgreSQL database and land the initial schema.

- Install and configure **Prisma 7** — `prisma-client` generator (not `prisma-client-js`), generated output in the source tree at `src/generated/prisma`, and the required `prisma.config.ts`.
- Read the Prisma 7 upgrade guide and quickstart before writing code; do not rely on Prisma 5/6 conventions.
- Connect to a Neon PostgreSQL database. `DATABASE_URL` points at the **development branch**; production gets its own branch later.
- Create the initial schema from the data model in `context/project-overview.md`: `User`, `ItemType`, `Item`, `Collection`, `ItemCollection` (join table), `Tag`, and the `ContentType` enum.
- Add the NextAuth v5 models: `Account`, `Session`, `VerificationToken`.
- Add indexes on foreign keys and cascade deletes where the spec calls for them (`onDelete: Cascade` on user-owned rows and both sides of `ItemCollection`).
- Add a shared Prisma client singleton at `src/lib/prisma.ts` (guarded against hot-reload duplication in dev).
- Generate the first migration with `prisma migrate dev` and verify with `prisma migrate status`.
- `npm run build` passes.

## Notes

<!-- Any extra notes -->

- Requirements source: `context/features/database-spec.md`.
- **Hard constraint:** never `prisma db push`, never edit the database structure by hand. All schema changes go through migrations — run in dev first, promoted to prod with `prisma migrate deploy`.
- The schema in `project-overview.md` is a draft and expected to evolve; treat it as the starting point, not the final shape.
- Prisma 7 breaking changes to watch: generator provider rename, generated client location, and the new `prisma.config.ts` requirement for migrations/introspection.
- Secrets (`DATABASE_URL`) live in `.env` and must stay out of git.
- No models or queries are wired into the UI in this feature — schema and client only.

## History

<!-- Keep this updated. Earliest to latest -->

- Initial setup of Next.js
- Project setup and boilerplate cleanup
- Dashboard UI Phase 1: shadcn/ui init, /dashboard route, top bar (search + New Item), dark mode by default, Sidebar/Main placeholders
- Dashboard UI Phase 1 (rebuild): sidebar as a full-height column with the top bar inside the content column, New Collection button added to the top bar, Geist font variables wired into the theme, item type colors added as global tokens, real DevStash metadata
- Dashboard UI Phase 2: real sidebar replacing the placeholder - collapsible desktop column with an icon rail, mobile drawer, top bar toggle, item types linking to /items/TYPE, favorite and recent collections, user avatar area, shadcn avatar/separator/sheet/tooltip added
- Dashboard UI Phase 3: main content area - 4 stats cards, recent collections as cards color-coded by their dominant item type, pinned items, 10 recent items, per-type styling shared through getItemTypeStyle(), shadcn card/badge added
- Database Foundation: Prisma 7 (`prisma-client` generator, `src/generated/prisma`, `prisma.config.ts`) against Neon PostgreSQL via the `@prisma/adapter-neon` driver adapter, initial schema (User, ItemType, Item, Collection, ItemCollection, Tag, ContentType) plus NextAuth v5 models, FK indexes and cascade deletes, `src/lib/prisma.ts` singleton, first migration `20260829101324_init`, and `npm run db:test` connectivity check
