import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/search/route";
import { auth } from "@/auth";
import { getCollections } from "@/lib/db/collections";
import { getSearchItems } from "@/lib/db/search-items";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ getCollections: vi.fn() }));
vi.mock("@/lib/db/search-items", () => ({ getSearchItems: vi.fn() }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

async function send() {
  const response = await GET();
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    body: await response.json(),
  };
}

describe("GET /api/search", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
  });

  it("returns the items and the collections trimmed for the palette, never cached", async () => {
    const items = [
      { id: "item-1", title: "useDebounce hook", typeName: "snippet", isPinned: false, isFavorite: false, preview: "export" },
    ];
    vi.mocked(getSearchItems).mockResolvedValue(items);
    vi.mocked(getCollections).mockResolvedValue([
      {
        id: "col-1",
        name: "React Patterns",
        description: "Hooks",
        isFavorite: true,
        itemCount: 3,
        dominantTypeName: "snippet",
        typeNames: ["snippet"],
      },
    ]);

    expect(await send()).toEqual({
      status: 200,
      cacheControl: "private, no-store",
      body: {
        success: true,
        data: {
          items,
          collections: [{ id: "col-1", name: "React Patterns", itemCount: 3, dominantTypeName: "snippet" }],
        },
        error: null,
      },
    });
  });

  it("answers a signed-out request with a 401 without a query", async () => {
    mockAuth.mockResolvedValue(null);

    const { status, cacheControl, body } = await send();

    expect(status).toBe(401);
    expect(cacheControl).toBe("private, no-store");
    expect(body.error).toBe("Your session has expired. Sign in again.");
    expect(getSearchItems).not.toHaveBeenCalled();
    expect(getCollections).not.toHaveBeenCalled();
  });

  it("answers a failed query with a 500 and a generic message", async () => {
    vi.mocked(getSearchItems).mockResolvedValue([]);
    vi.mocked(getCollections).mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = await send();

    expect(status).toBe(500);
    expect(body.error).toBe("Couldn't load your items and collections.");
  });
});
