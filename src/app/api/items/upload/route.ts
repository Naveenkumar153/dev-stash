import {
  COLLECTIONS_NOT_FOUND,
  FOLDER_NOT_FOUND,
  ITEM_CREATE_FAILED,
  ITEM_LIMIT_REACHED,
  PRO_REQUIRED,
  SESSION_EXPIRED,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { ownsCollections } from "@/lib/db/collections";
import { findFolder } from "@/lib/db/folders";
import { createFileItem } from "@/lib/db/items";
import { MAX_UPLOAD_BYTES, buildFileKey, validateUpload } from "@/lib/file-upload";
import { createFileItemSchema, type CreateFileItemData } from "@/lib/item-schemas";
import { putFile } from "@/lib/r2";
import { discardStoredFiles } from "@/lib/stored-files";
import { canCreateItem, getSessionEntitlements } from "@/lib/usage-limits";
import type { UploadItemResponse } from "@/types/items";

/** Room for the multipart boundaries and the text fields sent with the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

/** Every failure carries `fieldErrors`, which the New Item form always reads. */
function uploadFailure(error: string, status: number, fieldErrors: FieldErrors = {}) {
  return errorResponse(error, status, { fieldErrors });
}

/**
 * Creates a file or image item from the New Item dialog: the file goes to R2,
 * then the item is saved pointing at it. An API route rather than a server
 * action so the browser can report upload progress. The proxy doesn't cover
 * /api, so the session is checked here and answered with a 401.
 */
export async function POST(request: Request) {
  const entitlements = await getSessionEntitlements();
  if (!entitlements) {
    return uploadFailure(SESSION_EXPIRED, 401);
  }
  const { userId, hasProAccess } = entitlements;

  // File and image items are Pro-only: refused before the body is read.
  if (!hasProAccess) {
    return uploadFailure(PRO_REQUIRED, 403);
  }

  // Refuse an oversized body before buffering it. The file's own size is
  // checked against its type's limit once the form is read.
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) {
    return uploadFailure("Files can be up to 10 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return uploadFailure("Couldn't read the upload. Please try again.", 400);
  }

  const parsed = createFileItemSchema.safeParse({
    typeName: form.get("typeName"),
    title: form.get("title"),
    description: form.get("description"),
    tags: form.getAll("tags"),
    collectionIds: form.getAll("collectionIds"),
    folderId: form.get("folderId"),
  });
  if (!parsed.success) {
    return uploadFailure(parsed.error.issues[0].message, 400, getFieldErrors(parsed.error));
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return uploadFailure("Choose a file to upload.", 400, { file: "Choose a file to upload." });
  }

  const check = validateUpload(parsed.data.typeName, file);
  if (!check.success) {
    return uploadFailure(check.error, 400, { file: check.error });
  }

  // Checked before the file is stored, so a refused upload costs no R2 write.
  const limitError = await checkItemLimit(userId, hasProAccess);
  if (limitError) {
    return limitError;
  }

  const folderError = parsed.data.folderId && (await checkFolder(userId, parsed.data.folderId));
  if (folderError) {
    return folderError;
  }

  const collectionsError = await checkCollections(userId, parsed.data.collectionIds);
  if (collectionsError) {
    return collectionsError;
  }

  return storeAndCreate(userId, parsed.data, file, check.contentType);
}

/**
 * An error response when the user is at the Free item limit; null when they
 * may create another item. Every upload is Pro today, so this only bites if a
 * future rule lets Free accounts upload, but it keeps the item limit in force
 * on every create path.
 */
async function checkItemLimit(userId: string, hasProAccess: boolean): Promise<Response | null> {
  try {
    if ((await canCreateItem(userId, hasProAccess)).allowed) {
      return null;
    }
  } catch (error) {
    console.error("Checking the item limit failed", error);
    return uploadFailure(ITEM_CREATE_FAILED, 500);
  }

  return uploadFailure(ITEM_LIMIT_REACHED, 403);
}

/**
 * An error response when the upload's folder isn't one of `userId`'s, which
 * also covers a folder deleted while the dialog was open; null when it is.
 */
async function checkFolder(userId: string, folderId: string): Promise<Response | null> {
  try {
    if (await findFolder(userId, folderId)) {
      return null;
    }
  } catch (error) {
    console.error("Looking up upload folder failed", error);
    return uploadFailure(ITEM_CREATE_FAILED, 500);
  }

  return uploadFailure(FOLDER_NOT_FOUND, 404, { folderId: FOLDER_NOT_FOUND });
}

/**
 * An error response when one of the upload's collections isn't `userId`'s,
 * including one deleted while the dialog was open; null when all are.
 */
async function checkCollections(userId: string, collectionIds: string[]): Promise<Response | null> {
  try {
    if (await ownsCollections(userId, collectionIds)) {
      return null;
    }
  } catch (error) {
    console.error("Looking up upload collections failed", error);
    return uploadFailure(ITEM_CREATE_FAILED, 500);
  }

  return uploadFailure(COLLECTIONS_NOT_FOUND, 404, { collectionIds: COLLECTIONS_NOT_FOUND });
}

/**
 * Stores the file in R2 and saves the item. If the item can't be saved, the
 * stored file is removed again so nothing is left without an item.
 */
async function storeAndCreate(
  userId: string,
  data: CreateFileItemData,
  file: File,
  contentType: string,
) {
  const key = buildFileKey(userId, crypto.randomUUID(), file.name);

  try {
    await putFile(key, new Uint8Array(await file.arrayBuffer()), contentType);
  } catch (error) {
    console.error("Storing upload failed", error);
    return uploadFailure("Couldn't upload this file. Please try again.", 502);
  }

  try {
    const item = await createFileItem(userId, data, {
      key,
      fileName: file.name,
      fileSize: file.size,
    });

    if (item) {
      const body: UploadItemResponse = { success: true, data: item, error: null, fieldErrors: {} };
      return Response.json(body, { status: 201 });
    }

    await discardStoredFiles([key]);
    return uploadFailure("This item type isn't available.", 500);
  } catch (error) {
    console.error("Creating file item failed", error);
    await discardStoredFiles([key]);
    return uploadFailure(ITEM_CREATE_FAILED, 500);
  }
}
