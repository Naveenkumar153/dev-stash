/**
 * Standalone database connectivity check.
 *
 * Run with: npm run db:test
 *
 * Verifies that the Neon connection works through the Prisma driver adapter,
 * that every table in the schema exists, and that migrations are applied.
 * Read-only — it never writes to or alters the database.
 */

// Prisma 7 does not load .env automatically, and this script runs outside
// Next.js (which would otherwise load it), so dotenv has to come first.
import "dotenv/config";

/**
 * Imported lazily: the client singleton connects as soon as the module is
 * evaluated, so this has to happen after the environment has been checked.
 */
async function loadPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

type Db = Awaited<ReturnType<typeof loadPrisma>>;

interface AppliedMigration {
  migration_name: string;
  finished_at: Date | null;
}

/** Fails fast with a clear message instead of a driver-level stack trace. */
function assertEnv(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }
}

/** Confirms the pooled connection is actually reachable. */
async function checkConnection(db: Db): Promise<void> {
  await db.$queryRaw`SELECT 1`;
  console.log("✓ Connected to Neon over the pooled connection");
}

/** Confirms migrations ran, rather than the schema being pushed by hand. */
async function checkMigrations(db: Db): Promise<void> {
  const migrations = await db.$queryRaw<AppliedMigration[]>`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY finished_at ASC
  `;

  if (migrations.length === 0) {
    throw new Error("No migrations applied — run `npm run db:migrate`");
  }

  console.log(`✓ ${migrations.length} migration(s) applied:`);
  for (const migration of migrations) {
    const state = migration.finished_at ? "applied" : "PENDING / FAILED";
    console.log(`    ${migration.migration_name} (${state})`);
  }
}

/** Touches every model so a missing table surfaces as a failure. */
async function checkTables(db: Db): Promise<void> {
  const counts = {
    users: await db.user.count(),
    itemTypes: await db.itemType.count(),
    items: await db.item.count(),
    collections: await db.collection.count(),
    itemCollections: await db.itemCollection.count(),
    tags: await db.tag.count(),
    accounts: await db.account.count(),
    sessions: await db.session.count(),
    verificationTokens: await db.verificationToken.count(),
  };

  console.log(`✓ All ${Object.keys(counts).length} tables reachable:`);
  console.table(counts);
}

async function main(): Promise<void> {
  assertEnv();

  const db = await loadPrisma();

  try {
    await checkConnection(db);
    await checkMigrations(db);
    await checkTables(db);
    console.log("\nDatabase is healthy.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\n✗ Database check failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
