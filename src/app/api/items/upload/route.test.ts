import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/items/upload/route";
import { auth } from "@/auth";
import { createFileItem } from "@/lib/db/items";
import { deleteFile, putFile } from "@/lib/r2";
import type { ItemDetail } from "@/types/items";

// The session, the query and R2 are mocked; the upload rules and the Zod
// schema run for real, so these tests also cover what reaches R2 and the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ createFileItem: vi.fn() }));
vi.mock("@/lib/r2", () => ({ putFile: vi.fn(), deleteFile: vi.fn() }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const UPLOAD_ID = "8f14e45f-ceea-467f-a8a1-8c3d1a2b3c4d";
const KEY = `user-1/${UPLOAD_ID}-config.toml`;
const CREATE_FAILED = "Couldn't create this item. Please try again.";

const created: ItemDetail = {
  id: "cmtg169y00002zzx5wxanksok",
  title: "Server config",
  description: null,
  contentType: "file",
  content: null,
  url: null,
  language: null,
  fileName: "config.toml",
  fileSize: 21,
  isPinned: false,
  isFavorite: false,
  typeName: "file",
  tags: ["config", "server"],
  collections: [],
  createdAt: "2026-11-14T10:00:00.000Z",
  updatedAt: "2026-11-14T10:00:00.000Z",
};

interface FormOptions {
  fields?: Record<string, string | string[]>;
  /** Null sends no file part at all. */
  file?: File | null;
}

/** A multipart upload as the New Item dialog sends it, with overrides. */
function uploadRequest({ fields = {}, file }: FormOptions = {}) {
  const form = new FormData();
  const values = { typeName: "file", title: "  Server config  ", description: "", tags: ["config", "server"], ...fields };

  for (const [name, value] of Object.entries(values)) {
    for (const entry of [value].flat()) {
      form.append(name, entry);
    }
  }

  const upload = file === undefined ? new File(["[server]\nport = 3000\n"], "config.toml", { type: "" }) : file;
  if (upload) {
    form.append("file", upload);
  }

  return new Request("http://localhost/api/items/upload", { method: "POST", body: form });
}

async function send(request: Request) {
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
}

describe("POST /api/items/upload", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(UPLOAD_ID);
    vi.mocked(createFileItem).mockResolvedValue(created);
  });

  it("stores the file in R2 under the user, then creates the item pointing at it", async () => {
    const { status, body } = await send(uploadRequest());

    expect(status).toBe(201);
    expect(body).toEqual({ success: true, data: created, error: null, fieldErrors: {} });

    // The browser reported no type for .toml, so the extension decided it.
    expect(putFile).toHaveBeenCalledWith(KEY, expect.any(Uint8Array), "application/toml");
    const bytes = vi.mocked(putFile).mock.calls[0][1];
    expect(new TextDecoder().decode(bytes)).toBe("[server]\nport = 3000\n");

    expect(createFileItem).toHaveBeenCalledWith(
      "user-1",
      { typeName: "file", title: "Server config", description: null, tags: ["config", "server"] },
      { key: KEY, fileName: "config.toml", fileSize: 21 },
    );
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("refuses a signed-out request with a 401 before reading the body", async () => {
    mockAuth.mockResolvedValue(null);
    const request = uploadRequest();

    const { status, body } = await send(request);

    expect(status).toBe(401);
    expect(body.error).toBe("Your session has expired. Sign in again.");
    expect(request.bodyUsed).toBe(false);
    expect(putFile).not.toHaveBeenCalled();
  });

  it("refuses a body declared larger than any upload with a 413, without reading it", async () => {
    const request = new Request("http://localhost/api/items/upload", {
      method: "POST",
      headers: { "content-length": String(11 * 1024 * 1024) },
      body: "x",
    });

    const { status, body } = await send(request);

    expect(status).toBe(413);
    expect(body.error).toBe("Files can be up to 10 MB.");
    expect(request.bodyUsed).toBe(false);
  });

  it("answers a body that isn't a form with a 400", async () => {
    const request = new Request("http://localhost/api/items/upload", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not a form",
    });

    const { status, body } = await send(request);

    expect(status).toBe(400);
    expect(body.error).toBe("Couldn't read the upload. Please try again.");
  });

  it("returns the invalid fields without storing anything", async () => {
    const { status, body } = await send(uploadRequest({ fields: { title: "  ", typeName: "snippet" } }));

    expect(status).toBe(400);
    expect(body).toEqual({
      success: false,
      data: null,
      error: "Title is required",
      fieldErrors: { title: "Title is required", typeName: "Choose an item type" },
    });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("asks for a file when none was sent", async () => {
    const { status, body } = await send(uploadRequest({ file: null }));

    expect(status).toBe(400);
    expect(body.fieldErrors).toEqual({ file: "Choose a file to upload." });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("treats a text field named file as no file", async () => {
    const { status } = await send(uploadRequest({ file: null, fields: { file: "user-2/secret.pdf" } }));

    expect(status).toBe(400);
    expect(putFile).not.toHaveBeenCalled();
  });

  it("checks the file against its type's rules on the server too", async () => {
    const image = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });

    const { status, body } = await send(uploadRequest({ file: image }));

    expect(status).toBe(400);
    expect(body.fieldErrors.file).toBe(
      "Choose a .pdf, .txt, .md, .json, .yaml, .yml, .xml, .csv, .toml or .ini file.",
    );
    expect(putFile).not.toHaveBeenCalled();
  });

  it("refuses an image over 5 MB even though files may be 10 MB", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "photo.png", { type: "image/png" });

    const { status, body } = await send(uploadRequest({ fields: { typeName: "image" }, file: big }));

    expect(status).toBe(400);
    expect(body.error).toBe("Images can be up to 5 MB.");
    expect(putFile).not.toHaveBeenCalled();
  });

  it("answers an R2 failure with a 502 and creates no item", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(putFile).mockRejectedValue(new Error("R2 unavailable"));

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(502);
    expect(body.error).toBe("Couldn't upload this file. Please try again.");
    expect(createFileItem).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("removes the stored file when the item type is missing", async () => {
    vi.mocked(createFileItem).mockResolvedValue(null);

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(500);
    expect(body.error).toBe("This item type isn't available.");
    expect(deleteFile).toHaveBeenCalledWith(KEY);
  });

  it("removes the stored file when saving the item fails, without passing on the details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createFileItem).mockRejectedValue(new Error("connection reset by peer"));

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(500);
    expect(body).toEqual({ success: false, data: null, error: CREATE_FAILED, fieldErrors: {} });
    expect(deleteFile).toHaveBeenCalledWith(KEY);
  });

  it("still answers when removing the stored file fails too, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createFileItem).mockRejectedValue(new Error("connection reset by peer"));
    vi.mocked(deleteFile).mockRejectedValue(new Error("R2 unavailable"));

    const { status, body } = await send(uploadRequest());

    expect(status).toBe(500);
    expect(body.error).toBe(CREATE_FAILED);
    expect(log).toHaveBeenCalledWith("Discarding stored file failed", expect.objectContaining({ key: KEY }));
  });
});
