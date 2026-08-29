// Prisma 7 requires this file for all CLI work (migrate, generate, introspect).
// Connection URLs live here, not in the datasource block of schema.prisma.
// Prisma does not load .env automatically in v7 — `dotenv/config` must come first.
import "dotenv/config";
import { defineConfig } from "prisma/config";

// The app talks to Neon over the pooled connection (DATABASE_URL), but migrations
// must not go through the pooler, so the CLI prefers the direct one when it is set.
// Left undefined when neither is present so `prisma generate` still works without
// a database (e.g. `npm install` on a fresh clone or in CI).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 reads the seed command from here; the `prisma.seed` key in
    // package.json is the v5/v6 convention and is no longer picked up.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
