import { auth } from "@/auth";
import { getFieldErrors, type FieldErrors } from "@/lib/auth-schemas";
import { createFileItem } from "@/lib/db/items";
import { MAX_UPLOAD_BYTES, buildFileKey, validateUpload } from "@/lib/file-upload";
import { createFileItemSchema, type CreateFileItemData } from "@/lib/item-schemas";
import { putFile } from "@/lib/r2";
import { discardStoredFiles } from "@/lib/stored-files";
import type { UploadItemResponse } from "@/types/items";

/** Room for the multipart boundaries and the text fields sent with the file. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

const CREATE_FAILED = "Couldn't create this item. Please try again.";

function errorResponse(error: string, status: number, fieldErrors: FieldErrors = {}) {
  const body: UploadItemResponse = { success: false, data: null, error, fieldErrors };

  return Response.json(body, { status });
}

/**
 * Creates a file or image item from the New Item dialog: the file goes to R2,
 * then the item is saved pointing at it. An API route rather than a server
 * action so the browser can report upload progress. The proxy doesn't cover
 * /api, so the session is checked here and answered with a 401.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return errorResponse("Your session has expired. Sign in again.", 401);
  }

  // Refuse an oversized body before buffering it. The file's own size is
  // checked against its type's limit once the form is read.
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) {
    return errorResponse("Files can be up to 10 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Couldn't read the upload. Please try again.", 400);
  }

  const parsed = createFileItemSchema.safeParse({
    typeName: form.get("typeName"),
    title: form.get("title"),
    description: form.get("description"),
    tags: form.getAll("tags"),
  });
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 400, getFieldErrors(parsed.error));
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return errorResponse("Choose a file to upload.", 400, { file: "Choose a file to upload." });
  }

  const check = validateUpload(parsed.data.typeName, file);
  if (!check.success) {
    return errorResponse(check.error, 400, { file: check.error });
  }

  return storeAndCreate(userId, parsed.data, file, check.contentType);
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
    return errorResponse("Couldn't upload this file. Please try again.", 502);
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
    return errorResponse("This item type isn't available.", 500);
  } catch (error) {
    console.error("Creating file item failed", error);
    await discardStoredFiles([key]);
    return errorResponse(CREATE_FAILED, 500);
  }
}
