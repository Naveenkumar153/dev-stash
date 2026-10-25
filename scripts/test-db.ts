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

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Imported lazily: the client singleton connects as soon as the module is
 * evaluated, so this has to happen after the environment has been checked.
 */
async function loadPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

type Db = Awaited<ReturnType<typeof loadPrisma>>;

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

/**
 * Confirms every migration in prisma/migrations is applied and none failed,
 * rather than the schema being pushed by hand. Delegates to
 * `prisma migrate status`, which compares the folder against the database and
 * exits non-zero on a failed, unapplied or unknown migration.
 */
async function checkMigrations(): Promise<void> {
  try {
    const { stdout } = await run("npx", ["prisma", "migrate", "status"], {
      env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
    });
    const found = stdout.match(/\d+ migrations? found in prisma\/migrations/);
    console.log(`✓ Migrations in sync (${found?.[0] ?? "status clean"})`);
  } catch (error: unknown) {
    const output =
      error instanceof Error && "stdout" in error ? String(error.stdout).trim() : "";
    throw new Error(
      `Migrations are not in sync — see \`npm run db:status\`\n${output}`,
    );
  }
}

/** Touches every model so a missing table surfaces as a failure. */
async function checkTables(db: Db): Promise<void> {
  // Independent counts, so they go out together - one round trip each, awaited
  // one at a time, is most of this script's runtime.
  const [
    users,
    itemTypes,
    items,
    collections,
    itemCollections,
    tags,
    accounts,
    sessions,
    verificationTokens,
  ] = await Promise.all([
    db.user.count(),
    db.itemType.count(),
    db.item.count(),
    db.collection.count(),
    db.itemCollection.count(),
    db.tag.count(),
    db.account.count(),
    db.session.count(),
    db.verificationToken.count(),
  ]);

  const counts = {
    users,
    itemTypes,
    items,
    collections,
    itemCollections,
    tags,
    accounts,
    sessions,
    verificationTokens,
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
    await checkMigrations();
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
