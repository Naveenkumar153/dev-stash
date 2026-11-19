import sharp from "sharp";

import { getThumbnailKey } from "@/lib/file-upload";
import { putFile } from "@/lib/r2";

/** Wide enough for a gallery card at 2x on the widest grid column. */
export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_CONTENT_TYPE = "image/webp";

// Refuses decompression bombs: a small file that decodes to a huge bitmap.
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * A gallery thumbnail of an uploaded image: at most 640px wide (never
 * enlarged), turned upright from its EXIF orientation, as WebP. An animated
 * GIF gives its first frame. Throws when the bytes aren't an image sharp reads.
 */
export async function createThumbnail(image: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const output = await sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  // A copy over its own ArrayBuffer, so it can be a Response body.
  return Uint8Array.from(output);
}

/**
 * Makes and stores the thumbnail for the image stored at `key`, returning its
 * bytes, or null (logged) when that fails - the gallery then shows the
 * original, so a failure never fails the upload or the page.
 */
export async function storeThumbnail(
  key: string,
  image: Uint8Array,
): Promise<Uint8Array<ArrayBuffer> | null> {
  try {
    const thumbnail = await createThumbnail(image);
    await putFile(getThumbnailKey(key), thumbnail, THUMBNAIL_CONTENT_TYPE);
    return thumbnail;
  } catch (error) {
    console.error("Making a thumbnail failed", { key, error });
    return null;
  }
}
