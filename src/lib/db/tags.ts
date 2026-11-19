import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Deletes those of `tagIds` that no item uses any more, after an edit replaced
 * an item's tags or items were deleted. Tags are global, so one still on
 * anyone's item stays; the `none` filter makes that one statement, with no
 * window between checking and deleting.
 */
export async function deleteOrphanedTags(
  tagIds: string[],
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }
  await db.tag.deleteMany({ where: { id: { in: tagIds }, items: { none: {} } } });
}

/**
 * The best-effort form for after a write that already succeeded: a failed
 * cleanup only leaves an unused tag behind, so it's logged rather than thrown.
 */
export async function tryDeleteOrphanedTags(tagIds: string[]): Promise<void> {
  try {
    await deleteOrphanedTags(tagIds);
  } catch (error) {
    console.error("Removing unused tags failed", error);
  }
}
