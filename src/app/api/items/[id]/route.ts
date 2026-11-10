import { auth } from "@/auth";
import { getItemDetail } from "@/lib/db/items";
import { itemIdSchema } from "@/lib/item-schemas";
import type { ItemDetailResponse } from "@/types/items";

const NOT_FOUND = "This item doesn't exist or has been deleted.";

function errorResponse(error: string, status: number) {
  const body: ItemDetailResponse = { success: false, data: null, error };

  return Response.json(body, { status });
}

/**
 * The full item behind a card, fetched when the item drawer opens. The proxy
 * doesn't cover /api, so the session is checked here - and answered with a 401
 * rather than a redirect to the sign-in page, since the caller is a fetch.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/items/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return errorResponse("Your session has expired. Sign in again.", 401);
  }

  const { id } = await ctx.params;
  if (!itemIdSchema.safeParse(id).success) {
    return errorResponse(NOT_FOUND, 404);
  }

  try {
    const item = await getItemDetail(id);
    if (!item) {
      return errorResponse(NOT_FOUND, 404);
    }

    const body: ItemDetailResponse = { success: true, data: item, error: null };

    return Response.json(body);
  } catch (error) {
    console.error("Item detail failed", error);
    return errorResponse("Couldn't load this item. Please try again.", 500);
  }
}
