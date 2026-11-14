import { deleteFile } from "@/lib/r2";

/**
 * Removes files from R2 that no item points at any more: the item was
 * deleted, or never got saved. Best effort, so a failure is logged rather than
 * thrown - the file is unreachable either way, and the caller's own outcome
 * shouldn't change because cleanup failed.
 */
export async function discardStoredFiles(keys: string[]): Promise<void> {
  const results = await Promise.allSettled(keys.map((key) => deleteFile(key)));

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error("Discarding stored file failed", { key: keys[index], error: result.reason });
    }
  });
}
