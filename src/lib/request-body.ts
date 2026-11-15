export type JsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 400 | 413; error: string };

export const BODY_TOO_LARGE = "Request body is too large";
export const BODY_NOT_JSON = "Request body must be valid JSON";

/**
 * Parses a request's JSON body, refusing one over `maxBytes` before it is
 * buffered: route handlers have no body limit of their own, so a public route
 * would otherwise read whatever it is sent. A declared `Content-Length` over
 * the cap is refused unread; a chunked body is read until it passes the cap.
 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  if (Number(request.headers.get("content-length")) > maxBytes) {
    return { ok: false, status: 413, error: BODY_TOO_LARGE };
  }

  const bytes = await readCapped(request, maxBytes);
  if (!bytes) {
    return { ok: false, status: 413, error: BODY_TOO_LARGE };
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, status: 400, error: BODY_NOT_JSON };
  }
}

/** The body's bytes, or null once more than `maxBytes` have arrived. */
async function readCapped(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
