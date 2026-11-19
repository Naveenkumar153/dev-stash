import { ITEM_LOAD_FAILED, ITEM_NOT_FOUND, SESSION_EXPIRED } from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { getItemDetail } from "@/lib/db/items";
import { itemIdSchema } from "@/lib/item-schemas";
import { getSessionUserId } from "@/lib/session";
import type { ItemDetailResponse } from "@/types/items";

// The item's full content: never stored by a browser or shared cache.
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The full item behind a card, fetched when the item drawer opens. The proxy
 * doesn't cover /api, so the session is checked here - and answered with a 401
 * rather than a redirect to the sign-in page, since the caller is a fetch.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/items/[id]">) {
  if (!(await getSessionUserId())) {
    return errorResponse(SESSION_EXPIRED, 401, { headers: NO_STORE });
  }

  const { id } = await ctx.params;
  if (!itemIdSchema.safeParse(id).success) {
    return errorResponse(ITEM_NOT_FOUND, 404, { headers: NO_STORE });
  }

  try {
    const item = await getItemDetail(id);
    if (!item) {
      return errorResponse(ITEM_NOT_FOUND, 404, { headers: NO_STORE });
    }

    const body: ItemDetailResponse = { success: true, data: item, error: null };

    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("Item detail failed", error);
    return errorResponse(ITEM_LOAD_FAILED, 500, { headers: NO_STORE });
  }
}
