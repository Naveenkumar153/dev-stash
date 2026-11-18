import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/collections/route";
import { auth } from "@/auth";
import { getCollectionOptions } from "@/lib/db/collections";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ getCollectionOptions: vi.fn() }));

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

describe("GET /api/collections", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
  });

  it("returns the signed-in user's collections, never cached", async () => {
    const collections = [{ id: "col-1", name: "React Patterns" }];
    vi.mocked(getCollectionOptions).mockResolvedValue(collections);

    expect(await send()).toEqual({
      status: 200,
      cacheControl: "private, no-store",
      body: { success: true, data: collections, error: null },
    });
    expect(getCollectionOptions).toHaveBeenCalledWith("user-1");
  });

  it("answers a signed-out request with a 401 without a query", async () => {
    mockAuth.mockResolvedValue(null);

    const { status, body } = await send();

    expect(status).toBe(401);
    expect(body.error).toBe("Your session has expired. Sign in again.");
    expect(getCollectionOptions).not.toHaveBeenCalled();
  });

  it("answers a failed query with a 500 and a generic message", async () => {
    vi.mocked(getCollectionOptions).mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = await send();

    expect(status).toBe(500);
    expect(body.error).toBe("Couldn't load your collections.");
  });
});
