import { getUserFilePrefix } from "@/lib/file-upload";
import { deleteFile, listFileKeys } from "@/lib/r2";

/** R2 deletes in flight at once. */
export const DELETE_BATCH_SIZE = 50;

/**
 * Removes files from R2 that no item points at any more: the item was
 * deleted, or never got saved. Best effort, so a failure is logged rather than
 * thrown - the file is unreachable either way, and the caller's own outcome
 * shouldn't change because cleanup failed.
 */
export async function discardStoredFiles(keys: string[]): Promise<void> {
  // In batches, so a Pro account or folder with thousands of files doesn't
  // open thousands of R2 requests at once.
  for (let start = 0; start < keys.length; start += DELETE_BATCH_SIZE) {
    const batch = keys.slice(start, start + DELETE_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((key) => deleteFile(key)));

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error("Discarding stored file failed", { key: batch[index], error: result.reason });
      }
    });
  }
}

/**
 * Removes everything stored for `userId`, once their rows are gone: every
 * upload key starts with the user's prefix, so listing it also catches a file
 * whose row committed after the caller last read the user's items. Best effort
 * like `discardStoredFiles`, so a failed listing is logged, not thrown.
 */
export async function discardUserFiles(userId: string): Promise<void> {
  let keys: string[];
  try {
    keys = await listFileKeys(getUserFilePrefix(userId));
  } catch (error) {
    console.error("Listing stored files failed", { userId, error });
    return;
  }

  await discardStoredFiles(keys);
}
