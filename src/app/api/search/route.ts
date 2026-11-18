import { SEARCH_LOAD_FAILED, SESSION_EXPIRED } from "@/lib/action-result";
import { errorResponse } from "@/lib/api-response";
import { getCollections } from "@/lib/db/collections";
import { getSearchItems } from "@/lib/db/items";
import { toSearchCollection } from "@/lib/search";
import { getSessionUserId } from "@/lib/session";
import type { SearchDataResponse } from "@/types/search";

/** The data changes whenever the user creates, edits or deletes something. */
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Everything the command palette searches: the user's items with a short
 * preview each, and their collections with item counts. Fetched when the app
 * shell loads and again each time the palette opens; the palette then filters
 * in the browser, so typing makes no requests.
 *
 * Reads scope through `getCurrentUserId()` (the signed-in user) like the lists
 * and the item drawer, so every result opens something those show. The proxy
 * doesn't cover /api, so the session is checked here and answered with a 401.
 */
export async function GET() {
  if (!(await getSessionUserId())) {
    return errorResponse(SESSION_EXPIRED, 401, { headers: NO_STORE });
  }

  try {
    const [items, collections] = await Promise.all([getSearchItems(), getCollections()]);

    const body: SearchDataResponse = {
      success: true,
      data: { items, collections: collections.map(toSearchCollection) },
      error: null,
    };

    return Response.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("Loading search data failed", error);
    return errorResponse(SEARCH_LOAD_FAILED, 500, { headers: NO_STORE });
  }
}
