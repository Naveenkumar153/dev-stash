import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { putFile } from "@/lib/r2";
import { createThumbnail, storeThumbnail } from "@/lib/thumbnails";

// sharp runs for real (it's a local library, no service); only R2 is mocked.
vi.mock("@/lib/r2", () => ({ putFile: vi.fn() }));

async function png(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: "#3b82f6" },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buffer);
}

describe("createThumbnail", () => {
  it("shrinks a wide image to 640px wide, keeping its shape, as WebP", async () => {
    const thumbnail = await createThumbnail(await png(1600, 900));
    const meta = await sharp(thumbnail).metadata();

    expect(meta).toMatchObject({ format: "webp", width: 640, height: 360 });
  });

  it("never enlarges a small image", async () => {
    const meta = await sharp(await createThumbnail(await png(200, 100))).metadata();

    expect(meta).toMatchObject({ width: 200, height: 100 });
  });

  it("rejects bytes that aren't an image", async () => {
    await expect(createThumbnail(new TextEncoder().encode("not an image"))).rejects.toThrow();
  });
});

describe("storeThumbnail", () => {
  it("stores the thumbnail beside the original as WebP and returns it", async () => {
    const thumbnail = await storeThumbnail("user-1/abc-shot.png", await png(1200, 800));

    expect(thumbnail).toBeInstanceOf(Uint8Array);
    expect(putFile).toHaveBeenCalledWith("user-1/abc-shot.png.thumb.webp", thumbnail, "image/webp");
  });

  it("logs and returns null instead of throwing when the image can't be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await storeThumbnail("user-1/abc-shot.png", new Uint8Array([1, 2, 3]))).toBeNull();
    expect(putFile).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it("logs and returns null when R2 refuses the write", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(putFile).mockRejectedValue(new Error("R2 down"));

    expect(await storeThumbnail("user-1/abc-shot.png", await png(100, 100))).toBeNull();
  });
});
