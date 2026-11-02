/**
 * Deletes every user except the demo account, along with everything they own.
 *
 * Dry run (counts only):  npm run db:reset-users
 * Delete for real:        npm run db:reset-users -- --confirm
 *
 * Removes each other user's items, collections, custom item types, accounts,
 * sessions and verification tokens, plus any tag left with no items. The demo
 * user (`demo@devstash.io`) and its rows are untouched, as are system item
 * types. Point this at the development branch only, never production.
 */

// Prisma 7 does not load .env automatically, and this runs outside Next.js.
import "dotenv/config";

import { readFileSync } from "node:fs";

import { parse } from "dotenv";

/**
 * Imported lazily: the client singleton connects as soon as the module is
 * evaluated, so this has to happen after the target has been checked.
 */
async function loadPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

type Db = Awaited<ReturnType<typeof loadPrisma>>;

const DEMO_EMAIL = "demo@devstash.io";
const CONFIRM_FLAG = "--confirm";

/** Host only - the connection string carries credentials that must not be logged. */
function databaseHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

/** The production connection string from `.env.production`, if that file exists. */
function productionDatabaseUrl(): string | undefined {
  try {
    return parse(readFileSync(".env.production")).DATABASE_URL;
  } catch {
    return undefined;
  }
}

/**
 * No override: this deletes real accounts, so a production run has to be
 * done by hand, on purpose, not by flipping a variable.
 */
function assertSafeTarget(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set — copy .env.example to .env");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run: NODE_ENV is production.");
  }
  const productionUrl = productionDatabaseUrl();
  if (productionUrl && databaseHost(productionUrl) === databaseHost(url)) {
    throw new Error("Refusing to run: DATABASE_URL points at the production database.");
  }
  return databaseHost(url);
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  const host = assertSafeTarget();
  const db: Db = await loadPrisma();

  try {
    console.log(`Target: ${host}${confirmed ? "" : " (dry run)"}`);

    // Without the demo user every row would match, so stop instead of wiping
    // the database.
    const demo = await db.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true } });
    if (!demo) {
      throw new Error(`${DEMO_EMAIL} not found — run npm run db:seed first. Nothing deleted.`);
    }

    const users = await db.user.findMany({
      where: { id: { not: demo.id } },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });
    if (users.length === 0) {
      console.log("No other users. Nothing to delete.");
      return;
    }

    const userIds = users.map((user) => user.id);
    const emails = users.map((user) => user.email);
    const owned = { userId: { in: userIds } };

    const [items, collections, itemTypes, accounts, sessions, tokens] = await Promise.all([
      db.item.count({ where: owned }),
      db.collection.count({ where: owned }),
      db.itemType.count({ where: owned }),
      db.account.count({ where: owned }),
      db.session.count({ where: owned }),
      db.verificationToken.count({ where: { identifier: { in: emails } } }),
    ]);

    console.log(`\nUsers to delete (${users.length}):`);
    for (const email of emails) {
      console.log(`  - ${email}`);
    }
    console.log(
      `\nWith ${items} items, ${collections} collections, ${itemTypes} custom item types, ` +
        `${accounts} accounts, ${sessions} sessions and ${tokens} verification tokens.`,
    );

    if (!confirmed) {
      console.log(`\nDry run - nothing deleted. Re-run with ${CONFIRM_FLAG} to delete.`);
      return;
    }

    // One transaction, so a failure leaves the database as it was. Items go
    // before users because `Item.itemType` has no cascade: deleting a custom
    // type while its items still exist would be rejected.
    const [, deletedTokens, deletedUsers, deletedTags] = await db.$transaction([
      db.item.deleteMany({ where: owned }),
      db.verificationToken.deleteMany({ where: { identifier: { in: emails } } }),
      // Cascades to collections, their join rows, custom types, accounts and sessions.
      db.user.deleteMany({ where: { id: { in: userIds } } }),
      // Tags are global, so only the ones no remaining item uses go.
      db.tag.deleteMany({ where: { items: { none: {} } } }),
    ]);

    console.log(
      `\n✓ Deleted ${deletedUsers.count} users, ${deletedTokens.count} verification tokens ` +
        `and ${deletedTags.count} orphaned tags. ${DEMO_EMAIL} kept.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
