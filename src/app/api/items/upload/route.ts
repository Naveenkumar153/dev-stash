import {
  FOLDER_NOT_FOUND,
  ITEM_CREATE_FAILED,
  SESSION_EXPIRED,
  getFieldErrors,
  type FieldErrors,
} from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { findFolder } from "@/lib/db/folders";
import { createFileItem } from "@/lib/db/items";
import { MAX_UPLOAD_BYTES, buildFileKey, validateUpload } from "@/lib/file-upload";
import { createFileItemSchema, type CreateFileItemData } from "@/lib/item-schemas";
import { putFile } from "@/lib/r2";
import { getSessionUserId } from "@/lib/session";
import { discardStoredFiles } from "@/lib/stored-files";
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
  const userId = await getSessionUserId();
  if (!userId) {
    return uploadFailure(SESSION_EXPIRED, 401);
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

  // Checked before the file is stored, so a missing folder costs no R2 write.
  const folderError = parsed.data.folderId && (await checkFolder(userId, parsed.data.folderId));
  if (folderError) {
    return folderError;
  }

  return storeAndCreate(userId, parsed.data, file, check.contentType);
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
