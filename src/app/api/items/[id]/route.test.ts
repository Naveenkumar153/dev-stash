import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/items/[id]/route";
import { auth } from "@/auth";
import { getItemDetail } from "@/lib/db/items";
import type { ItemDetail } from "@/types/items";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemDetail: vi.fn() }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const ID = "cmtg169y00002zzx5wxanksok";

const item: ItemDetail = {
  id: ID,
  title: "useDebounce hook",
  description: null,
  contentType: "text",
  content: "export function useDebounce() {}",
  url: null,
  language: "typescript",
  fileName: null,
  fileSize: null,
  isPinned: false,
  isFavorite: false,
  typeName: "snippet",
  tags: ["react"],
  collections: [],
  createdAt: "2026-11-14T10:00:00.000Z",
  updatedAt: "2026-11-14T10:00:00.000Z",
};

async function send(id: string) {
  const response = await GET(new Request(`http://localhost/api/items/${id}`), {
    params: Promise.resolve({ id }),
  } as RouteContext<"/api/items/[id]">);
  return {
    status: response.status,
    cacheControl: response.headers.get("cache-control"),
    body: await response.json(),
  };
}

describe("GET /api/items/[id]", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
  });

  it("returns the item's detail, never cached", async () => {
    vi.mocked(getItemDetail).mockResolvedValue(item);

    expect(await send(ID)).toEqual({
      status: 200,
      cacheControl: "private, no-store",
      body: { success: true, data: item, error: null },
    });
    expect(getItemDetail).toHaveBeenCalledWith(ID);
  });

  it("answers a signed-out request with a 401, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    const { status, cacheControl } = await send(ID);

    expect(status).toBe(401);
    expect(cacheControl).toBe("private, no-store");
    expect(getItemDetail).not.toHaveBeenCalled();
  });

  it("answers a malformed id with a 404, without a query", async () => {
    expect((await send("not-a-cuid")).status).toBe(404);
    expect(getItemDetail).not.toHaveBeenCalled();
  });

  it("answers an item that isn't the user's (or doesn't exist) with a 404", async () => {
    vi.mocked(getItemDetail).mockResolvedValue(null);

    expect(await send(ID)).toMatchObject({ status: 404, cacheControl: "private, no-store" });
  });

  it("answers a failed query with a logged 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getItemDetail).mockRejectedValue(new Error("connection lost"));

    expect(await send(ID)).toMatchObject({ status: 500, cacheControl: "private, no-store" });
    expect(log).toHaveBeenCalled();
  });
});
