import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/items/[id]/file/route";
import { auth } from "@/auth";
import { getItemFile } from "@/lib/db/items";
import { getFile } from "@/lib/r2";
import { storeThumbnail } from "@/lib/thumbnails";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ getItemFile: vi.fn() }));
vi.mock("@/lib/r2", () => ({ getFile: vi.fn() }));
vi.mock("@/lib/thumbnails", () => ({
  THUMBNAIL_CONTENT_TYPE: "image/webp",
  storeThumbnail: vi.fn(),
}));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const ID = "cmtg169y00002zzx5wxanksok";
const KEY = "user-1/abc-shot.png";

function stored(text: string) {
  const bytes = new TextEncoder().encode(text);
  return { body: new Response(bytes).body!, size: bytes.byteLength };
}

async function fetchFile(query = "") {
  const response = await GET(new Request(`http://localhost/api/items/${ID}/file${query}`), {
    params: Promise.resolve({ id: ID }),
  } as RouteContext<"/api/items/[id]/file">);
  return {
    status: response.status,
    type: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
    text: await response.text(),
  };
}

describe("GET /api/items/[id]/file", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: true }, expires: "2099-01-01T00:00:00.000Z" });
    vi.mocked(getItemFile).mockResolvedValue({ key: KEY, fileName: "shot.png" });
  });

  it("streams an image inline for the drawer's preview", async () => {
    vi.mocked(getFile).mockResolvedValue(stored("original"));

    expect(await fetchFile()).toMatchObject({
      status: 200,
      type: "image/png",
      disposition: expect.stringContaining("inline"),
      text: "original",
    });
    expect(getFile).toHaveBeenCalledWith(KEY);
  });

  it("serves the stored thumbnail for ?thumb=1", async () => {
    vi.mocked(getFile).mockResolvedValue(stored("thumb"));

    expect(await fetchFile("?thumb=1")).toMatchObject({ status: 200, type: "image/webp", text: "thumb" });
    expect(getFile).toHaveBeenCalledWith(`${KEY}.thumb.webp`);
    expect(storeThumbnail).not.toHaveBeenCalled();
  });

  it("makes and stores a missing thumbnail from the original on first request", async () => {
    vi.mocked(getFile).mockImplementation(async (key) => (key === KEY ? stored("original") : null));
    vi.mocked(storeThumbnail).mockResolvedValue(new TextEncoder().encode("fresh thumb"));

    expect(await fetchFile("?thumb=1")).toMatchObject({
      status: 200,
      type: "image/webp",
      text: "fresh thumb",
    });
    expect(storeThumbnail).toHaveBeenCalledWith(KEY, new TextEncoder().encode("original"));
  });

  it("serves the original when making the thumbnail fails", async () => {
    vi.mocked(getFile).mockImplementation(async (key) => (key === KEY ? stored("original") : null));
    vi.mocked(storeThumbnail).mockResolvedValue(null);

    expect(await fetchFile("?thumb=1")).toMatchObject({ status: 200, type: "image/png", text: "original" });
  });

  it("serves an SVG as it is, since it has no thumbnail", async () => {
    vi.mocked(getItemFile).mockResolvedValue({ key: "user-1/abc-logo.svg", fileName: "logo.svg" });
    vi.mocked(getFile).mockResolvedValue(stored("<svg/>"));

    expect(await fetchFile("?thumb=1")).toMatchObject({ type: "image/svg+xml", text: "<svg/>" });
    expect(getFile).toHaveBeenCalledWith("user-1/abc-logo.svg");
  });

  it("answers 404 when neither the thumbnail nor the original is stored", async () => {
    vi.mocked(getFile).mockResolvedValue(null);

    expect((await fetchFile("?thumb=1")).status).toBe(404);
  });

  it("answers 404 for an item that isn't the user's", async () => {
    vi.mocked(getItemFile).mockResolvedValue(null);

    expect((await fetchFile("?thumb=1")).status).toBe(404);
    expect(getFile).not.toHaveBeenCalled();
  });

  it("answers 401 signed out", async () => {
    mockAuth.mockResolvedValue(null);

    expect((await fetchFile()).status).toBe(401);
  });
});
