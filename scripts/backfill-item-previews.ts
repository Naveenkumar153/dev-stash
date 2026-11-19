/**
 * Fills `Item.preview` for rows saved before the column existed.
 *
 * Dry run (counts only):  npm run db:backfill-previews
 * Write the previews:     npm run db:backfill-previews -- --confirm
 *
 * Only rows whose preview is null are touched, and each gets the excerpt the
 * app writes on save (`getItemPreview()`), so running it twice changes nothing.
 * Safe for any environment, production included, since it only fills a cache
 * column - but it runs against whatever `DATABASE_URL` points at, so the host
 * is printed first. Until it runs, search cuts the missing previews itself.
 */

// Prisma 7 does not load .env automatically, and this runs outside Next.js.
import "dotenv/config";

import { getItemPreview } from "@/lib/search";

const CONFIRM_FLAG = "--confirm";
const BATCH_SIZE = 500;

/** Imported lazily, so the host is printed before anything connects. */
async function loadPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

function databaseHost(url: string | undefined): string {
  try {
    return url ? new URL(url).host : "DATABASE_URL is not set";
  } catch {
    return "unparseable DATABASE_URL";
  }
}

async function main() {
  const confirmed = process.argv.includes(CONFIRM_FLAG);
  console.log(`Target: ${databaseHost(process.env.DATABASE_URL)}`);

  const prisma = await loadPrisma();
  try {
    const missing = await prisma.item.count({ where: { preview: null } });
    console.log(`${missing} items have no stored preview.`);
    if (!confirmed || missing === 0) {
      if (!confirmed) console.log(`Dry run - nothing written. Re-run with ${CONFIRM_FLAG}.`);
      return;
    }

    let written = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await prisma.item.findMany({
        where: { preview: null },
        orderBy: { id: "asc" },
        take: BATCH_SIZE,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
        select: { id: true, content: true, url: true, fileName: true },
      });
      if (rows.length === 0) break;
      cursor = rows[rows.length - 1].id;

      // Items with nothing to preview stay null; they're simply skipped next batch.
      const updates = rows.flatMap(({ id, ...payload }) => {
        const preview = getItemPreview(payload);
        return preview ? [prisma.item.update({ where: { id }, data: { preview } })] : [];
      });
      await prisma.$transaction(updates);
      written += updates.length;
    }

    console.log(`✓ Wrote ${written} previews.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
