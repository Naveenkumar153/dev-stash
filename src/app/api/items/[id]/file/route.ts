import { FILE_NOT_FOUND, SESSION_EXPIRED } from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { getItemFile } from "@/lib/db/items";
import {
  contentDisposition,
  getContentTypeForFileName,
  getThumbnailKey,
  hasThumbnail,
  isImageFileName,
} from "@/lib/file-upload";
import { itemIdSchema } from "@/lib/item-schemas";
import { getFile } from "@/lib/r2";
import { getSessionUserId } from "@/lib/session";
import { THUMBNAIL_CONTENT_TYPE, storeThumbnail } from "@/lib/thumbnails";

/**
 * Served files never run as pages on this origin: an SVG opened directly
 * can't execute its scripts, and nothing in a file can load other resources.
 */
const FILE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";

/**
 * The download proxy: streams an item's file from R2 through this origin, so
 * the browser never fetches from R2 directly and there's no CORS to configure.
 * Images are served inline for the drawer's preview unless `?download=1` asks
 * for a save; every other file is always a download. The content type comes
 * from the stored name's extension, never from what the uploader reported.
 * `?thumb=1` asks for an image's small gallery copy instead (an SVG has none
 * and is served as it is).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/items/[id]/file">) {
  if (!(await getSessionUserId())) {
    return errorResponse(SESSION_EXPIRED, 401);
  }

  const { id } = await ctx.params;
  if (!itemIdSchema.safeParse(id).success) {
    return errorResponse(FILE_NOT_FOUND, 404);
  }

  try {
    const item = await getItemFile(id);
    if (!item) {
      return errorResponse(FILE_NOT_FOUND, 404);
    }

    const params = new URL(request.url).searchParams;
    if (params.has("thumb") && hasThumbnail(item.fileName)) {
      return await serveThumbnail(item);
    }

    const stored = await getFile(item.key);
    if (!stored) {
      return errorResponse(FILE_NOT_FOUND, 404);
    }

    const disposition =
      !params.has("download") && isImageFileName(item.fileName) ? "inline" : "attachment";
    return new Response(stored.body, {
      headers: fileHeaders(getContentTypeForFileName(item.fileName), disposition, item.fileName, stored.size),
    });
  } catch (error) {
    console.error("Serving file failed", error);
    return errorResponse("Couldn't load this file. Please try again.", 500);
  }
}

function fileHeaders(
  contentType: string,
  disposition: "inline" | "attachment",
  fileName: string,
  size: number | undefined,
): Headers {
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition(disposition, fileName),
    "Content-Security-Policy": FILE_CSP,
    "X-Content-Type-Options": "nosniff",
    // A file item's file never changes, so the preview can be reused.
    "Cache-Control": "private, max-age=3600",
  });
  if (size !== undefined) {
    headers.set("Content-Length", String(size));
  }
  return headers;
}

/**
 * An image's gallery thumbnail. Images uploaded before thumbnails existed have
 * none yet, so the first request makes it from the original and stores it;
 * if that fails, the original is served instead, as it was before.
 */
async function serveThumbnail(item: { key: string; fileName: string }): Promise<Response> {
  const stored = await getFile(getThumbnailKey(item.key));
  if (stored) {
    return new Response(stored.body, {
      headers: fileHeaders(THUMBNAIL_CONTENT_TYPE, "inline", item.fileName, stored.size),
    });
  }

  const original = await getFile(item.key);
  if (!original) {
    return errorResponse(FILE_NOT_FOUND, 404);
  }
  const bytes = new Uint8Array(await new Response(original.body).arrayBuffer());
  const thumbnail = await storeThumbnail(item.key, bytes);

  return thumbnail
    ? new Response(thumbnail, {
        headers: fileHeaders(THUMBNAIL_CONTENT_TYPE, "inline", item.fileName, thumbnail.byteLength),
      })
    : new Response(bytes, {
        headers: fileHeaders(
          getContentTypeForFileName(item.fileName),
          "inline",
          item.fileName,
          bytes.byteLength,
        ),
      });
}
