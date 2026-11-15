import { ITEM_CREATE_FAILED } from "@/lib/action-result";
import type { UpdateItemInput } from "@/lib/item-schemas";
import type { FileItemType } from "@/lib/item-types";
import { postFormWithProgress } from "@/lib/upload-request";
import type { UploadItemResponse } from "@/types/items";

export const UPLOAD_ITEM_URL = "/api/items/upload";

export const CONNECTION_FAILED = "Couldn't reach the server. Check your connection and try again.";

/** Where a new file or image item goes: its type, and for a file the folder, null at the top level. */
export interface UploadTarget {
  typeName: FileItemType;
  folderId: string | null;
}

/**
 * Sends a file or image item to the upload route, reporting progress as the
 * file goes up. Never throws: a dropped connection or a reply that isn't JSON
 * comes back as an error result.
 */
export async function uploadFileItem(
  { typeName, folderId }: UploadTarget,
  input: UpdateItemInput,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadItemResponse> {
  const form = new FormData();
  form.set("typeName", typeName);
  if (folderId) {
    form.set("folderId", folderId);
  }
  form.set("title", input.title);
  form.set("description", input.description ?? "");
  for (const tag of input.tags) {
    form.append("tags", tag);
  }
  for (const collectionId of input.collectionIds) {
    form.append("collectionIds", collectionId);
  }
  form.set("file", file);

  try {
    const { body } = await postFormWithProgress<UploadItemResponse>(UPLOAD_ITEM_URL, form, onProgress);
    return body ?? { success: false, data: null, error: ITEM_CREATE_FAILED, fieldErrors: {} };
  } catch {
    return { success: false, data: null, error: CONNECTION_FAILED, fieldErrors: {} };
  }
}
