/**
 * Standalone database check.
 *
 * Run with: npm run db:test
 *
 * Verifies that the Neon connection works through the Prisma driver adapter,
 * that every table in the schema exists and that migrations are applied, then
 * reads back the seeded demo data to confirm relations resolve end to end.
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

const DEMO_EMAIL = "demo@devstash.io";

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

/** Shows the system item types with the icon and colour the UI reads. */
async function showItemTypes(db: Db): Promise<void> {
  const types = await db.itemType.findMany({
    where: { isSystem: true },
    select: { name: true, icon: true, color: true, _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  console.log(`\nSystem item types (${types.length}):`);
  console.table(
    types.map((type) => ({
      name: type.name,
      icon: type.icon,
      color: type.color,
      items: type._count.items,
    })),
  );
}

/** Returns the demo user, or null when the seed has not been run yet. */
async function findDemoUser(db: Db) {
  return db.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: {
      email: true,
      name: true,
      isPro: true,
      emailVerified: true,
      passwordHash: true,
      _count: { select: { items: true, collections: true } },
    },
  });
}

/**
 * Reads collections with their items through the join table, which is the
 * relation the dashboard depends on most.
 */
async function showCollections(db: Db): Promise<void> {
  const collections = await db.collection.findMany({
    where: { user: { email: DEMO_EMAIL } },
    orderBy: { name: "asc" },
    select: {
      name: true,
      description: true,
      isFavorite: true,
      items: {
        orderBy: { item: { title: "asc" } },
        select: {
          item: {
            select: {
              title: true,
              isPinned: true,
              contentType: true,
              itemType: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  console.log(`\nCollections (${collections.length}):`);
  for (const collection of collections) {
    const star = collection.isFavorite ? " ★" : "";
    console.log(`\n  ${collection.name}${star} — ${collection.description ?? ""}`);
    for (const { item } of collection.items) {
      const pin = item.isPinned ? " 📌" : "";
      console.log(
        `    · [${item.itemType.name}] ${item.title} (${item.contentType})${pin}`,
      );
    }
  }
}

/** Prints the demo user summary and a breakdown of their items. */
async function showDemoData(db: Db): Promise<void> {
  const user = await findDemoUser(db);

  if (!user) {
    console.log(`\n⚠ No demo user (${DEMO_EMAIL}) — run \`npm run db:seed\``);
    return;
  }

  console.log("\nDemo user:");
  console.table({
    email: user.email,
    name: user.name ?? "—",
    isPro: user.isPro,
    emailVerified: user.emailVerified !== null,
    passwordSet: user.passwordHash !== null,
    collections: user._count.collections,
    items: user._count.items,
  });

  await showItemTypes(db);
  await showCollections(db);

  const pinned = await db.item.findMany({
    where: { user: { email: DEMO_EMAIL }, isPinned: true },
    select: { title: true },
    orderBy: { title: "asc" },
  });
  console.log(`\nPinned items (${pinned.length}):`);
  for (const item of pinned) console.log(`  📌 ${item.title}`);
}

async function main(): Promise<void> {
  assertEnv();

  const db = await loadPrisma();

  try {
    await checkConnection(db);
    await checkMigrations(db);
    await checkTables(db);
    await showDemoData(db);
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
