import { COLLECTIONS_LOAD_FAILED, SESSION_EXPIRED } from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { getCollectionOptions } from "@/lib/db/collections";
import { getSessionUserId } from "@/lib/session";
import type { CollectionOptionsResponse } from "@/types/collections";

/** The list is the user's own and changes as they create collections. */
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The signed-in user's collections, for the Collections picker in the New Item
 * dialog and the item drawer's edit form. Scoped to the session user, the same
 * user the item writes check collections against. The proxy doesn't cover
 * /api, so the session is checked here and answered with a 401.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return errorResponse(SESSION_EXPIRED, 401, { headers: NO_STORE });
  }

  try {
    const body: CollectionOptionsResponse = {
      success: true,
      data: await getCollectionOptions(userId),
      error: null,
    };

    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("Loading collection options failed", error);
    return errorResponse(COLLECTIONS_LOAD_FAILED, 500, { headers: NO_STORE });
  }
}
