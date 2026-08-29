# CLAUDE.md

# DevStash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links and custom types.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Context Files

Read the following files to get the full context of the project:

 - @context/project-overview.md
 - @context/coding-standards.md
 - @context/ai-interaction.md
 - @context/current-feature.md

@AGENTS.md

## Commands

- `npm run dev` — start dev server (Turbopack) at localhost:3000
- `npm run build` — production build
- `npm run start` — start production server (requires build first)
- `npm run lint` — run ESLint (flat config, `eslint.config.mjs`)
- `npm run db:migrate` — create + apply a migration against the dev database (`prisma migrate dev`)
- `npm run db:deploy` — apply pending migrations in production (`prisma migrate deploy`)
- `npm run db:status` — check migrations are in sync (`prisma migrate status`)
- `npm run db:generate` — regenerate Prisma Client into `src/generated/prisma` (also runs on `postinstall`)
- `npm run db:studio` — open Prisma Studio
- `npm run db:test` — verify the DB connection, applied migrations and all tables, and print the seeded demo data (`scripts/test-db.ts`)
- `npm run db:seed` — seed dev data: demo user, system item types, collections and items (`prisma/seed.ts`)

<!-- No test runner is configured in this project. -->