import { FILE_NOT_FOUND, SESSION_EXPIRED } from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { getItemFile } from "@/lib/db/items";
import {
  contentDisposition,
  getContentTypeForFileName,
  isImageFileName,
} from "@/lib/file-upload";
import { itemIdSchema } from "@/lib/item-schemas";
import { getFile } from "@/lib/r2";
import { getSessionUserId } from "@/lib/session";

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
    const stored = item && (await getFile(item.key));
    if (!item || !stored) {
      return errorResponse(FILE_NOT_FOUND, 404);
    }

    const download = new URL(request.url).searchParams.has("download");
    const disposition = !download && isImageFileName(item.fileName) ? "inline" : "attachment";

    const headers = new Headers({
      "Content-Type": getContentTypeForFileName(item.fileName),
      "Content-Disposition": contentDisposition(disposition, item.fileName),
      "Content-Security-Policy": FILE_CSP,
      "X-Content-Type-Options": "nosniff",
      // A file item's file never changes, so the preview can be reused.
      "Cache-Control": "private, max-age=3600",
    });
    if (stored.size !== undefined) {
      headers.set("Content-Length", String(stored.size));
    }

    return new Response(stored.body, { headers });
  } catch (error) {
    console.error("Serving file failed", error);
    return errorResponse("Couldn't load this file. Please try again.", 500);
  }
}
