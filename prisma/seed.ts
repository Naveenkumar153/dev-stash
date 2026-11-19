/**
 * Development seed data.
 *
 * Run with: npm run db:seed
 *
 * Creates a demo user, the 7 system item types, and 18 tagged items: 10 in
 * 3 collections and 8 in none. The demo user models a Free account, so it
 * stays within the Free plan's 3 collections and 50 items (`src/lib/plans.ts`).
 * Safe to re-run: system types are matched by name, and the demo
 * user's collections and items are cleared before being recreated, along with
 * the stored files of any items uploaded through the app.
 *
 * Scoped entirely to the demo user — it never touches other users' rows. Point
 * this at the development branch only, never production.
 */

// Prisma 7 does not load .env automatically, and this runs outside Next.js.
import "dotenv/config";

import { ContentType } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { discardUserFiles } from "@/lib/stored-files";

import {
  COLLECTIONS,
  SYSTEM_TYPES,
  UNCOLLECTED_ITEMS,
  type SeedCollection,
  type SeedItem,
  type SystemTypeName,
} from "./seed-data";

const DEMO_EMAIL = "demo@devstash.io";
const DEMO_PASSWORD = "12345678";

/** A type's name determines which payload column an item uses. */
function contentTypeFor(type: SystemTypeName): ContentType {
  if (type === "link") return ContentType.url;
  if (type === "file" || type === "image") return ContentType.file;
  return ContentType.text;
}

/** Creates or updates the demo user, matched on the unique email. */
async function seedUser(): Promise<string> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo User", passwordHash, emailVerified: new Date() },
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash,
      isPro: false,
      emailVerified: new Date(),
    },
  });

  console.log(`✓ Demo user ${user.email}`);
  return user.id;
}

/**
 * System types have `userId = null`, and Postgres treats NULL as distinct from
 * NULL, so the @@unique([userId, name]) constraint does not dedupe them and an
 * upsert cannot be relied on. Match explicitly instead.
 */
async function seedSystemTypes(): Promise<Map<SystemTypeName, string>> {
  const ids = new Map<SystemTypeName, string>();

  for (const type of SYSTEM_TYPES) {
    const existing = await prisma.itemType.findFirst({
      where: { name: type.name, userId: null },
    });

    const record = existing
      ? await prisma.itemType.update({
          where: { id: existing.id },
          data: { icon: type.icon, color: type.color, isSystem: true },
        })
      : await prisma.itemType.create({
          data: { ...type, isSystem: true },
        });

    ids.set(type.name, record.id);
  }

  console.log(`✓ ${ids.size} system item types`);
  return ids;
}

/**
 * Clears the demo user's own collections and items so re-runs stay clean,
 * including files and images uploaded through the app, whose stored files are
 * removed from R2 once their rows are gone so none is left behind.
 */
async function clearDemoData(userId: string): Promise<void> {
  const { count: items } = await prisma.item.deleteMany({ where: { userId } });
  const { count: collections } = await prisma.collection.deleteMany({
    where: { userId },
  });
  await discardUserFiles(userId);

  if (items > 0 || collections > 0) {
    console.log(
      `✓ Cleared previous demo data (${collections} collections, ${items} items)`,
    );
  }
}

/** Creates one demo item, in `collectionId` when given. */
async function seedItem(
  item: SeedItem,
  userId: string,
  typeIds: Map<SystemTypeName, string>,
  collectionId?: string,
): Promise<void> {
  const itemTypeId = typeIds.get(item.type);
  if (!itemTypeId) throw new Error(`Unknown item type: ${item.type}`);

  await prisma.item.create({
    data: {
      title: item.title,
      description: item.description,
      contentType: contentTypeFor(item.type),
      content: item.content ?? null,
      url: item.url ?? null,
      language: item.language ?? null,
      isPinned: item.isPinned ?? false,
      isFavorite: item.isFavorite ?? false,
      userId,
      itemTypeId,
      ...(collectionId && { collections: { create: { collectionId } } }),
      tags: {
        connectOrCreate: item.tags.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
  });
}

/** Creates one collection and its items, linked through the join table. */
async function seedCollection(
  collection: SeedCollection,
  userId: string,
  typeIds: Map<SystemTypeName, string>,
): Promise<number> {
  const created = await prisma.collection.create({
    data: {
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite ?? false,
      userId,
      defaultTypeId: typeIds.get(collection.items[0].type),
    },
  });

  for (const item of collection.items) {
    await seedItem(item, userId, typeIds, created.id);
  }

  return collection.items.length;
}

/**
 * The seed plants a known password and clears the demo user's rows, so it must
 * never run against production. `ALLOW_SEED=true` is the deliberate override for
 * seeding a production-like environment on purpose.
 *
 * Prisma 7 runs the `migrations.seed` command in `prisma.config.ts` only from
 * `prisma db seed` (`npm run db:seed`), never from `prisma migrate dev`.
 */
function assertSafeTarget(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Refusing to seed: NODE_ENV is production. Set ALLOW_SEED=true to override.",
    );
  }

  // Surfaces a mistargeted run in the output even when NODE_ENV says nothing.
  console.log(`Seeding ${databaseHost()}`);
}

/** Host only - the connection string carries credentials that must not be logged. */
function databaseHost(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return "unknown host";
  }

  try {
    return new URL(url).host;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

async function main(): Promise<void> {
  assertSafeTarget();

  const userId = await seedUser();
  const typeIds = await seedSystemTypes();

  await clearDemoData(userId);

  let collectedItems = 0;
  for (const collection of COLLECTIONS) {
    collectedItems += await seedCollection(collection, userId, typeIds);
  }
  for (const item of UNCOLLECTED_ITEMS) {
    await seedItem(item, userId, typeIds);
  }

  console.log(
    `✓ ${COLLECTIONS.length} collections with ${collectedItems} items, ` +
      `plus ${UNCOLLECTED_ITEMS.length} items in no collection`,
  );
  console.log("\nSeed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("\n✗ Seed failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
