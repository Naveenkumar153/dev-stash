import { describe, expect, it, vi } from "vitest";

import { ITEM_CREATE_FAILED } from "@/lib/action-result";
import { CONNECTION_FAILED, UPLOAD_ITEM_URL, uploadFileItem } from "@/lib/item-upload";
import { postFormWithProgress } from "@/lib/upload-request";

vi.mock("@/lib/upload-request", () => ({ postFormWithProgress: vi.fn() }));

const input = { title: "Release notes", description: null, tags: ["docs", "release"] };
const file = new File(["%PDF-1.7"], "notes.pdf", { type: "application/pdf" });

/** The form the one upload sent. */
function sentForm(): FormData {
  return vi.mocked(postFormWithProgress).mock.calls[0][1];
}

describe("uploadFileItem", () => {
  it("sends the type, folder, fields, each tag and the file, and returns the route's reply", async () => {
    const reply = { success: true, data: { id: "item-1" }, error: null, fieldErrors: {} };
    vi.mocked(postFormWithProgress).mockResolvedValue({ status: 201, body: reply });
    const onProgress = vi.fn();

    const result = await uploadFileItem(
      { typeName: "file", folderId: "folder-1" },
      input,
      file,
      onProgress,
    );

    expect(result).toBe(reply);
    expect(postFormWithProgress).toHaveBeenCalledWith(UPLOAD_ITEM_URL, expect.any(FormData), onProgress);
    const form = sentForm();
    expect(form.get("typeName")).toBe("file");
    expect(form.get("folderId")).toBe("folder-1");
    expect(form.get("title")).toBe("Release notes");
    expect(form.get("description")).toBe("");
    expect(form.getAll("tags")).toEqual(["docs", "release"]);
    expect((form.get("file") as File).name).toBe("notes.pdf");
  });

  it("leaves the folder out at the top level", async () => {
    vi.mocked(postFormWithProgress).mockResolvedValue({ status: 201, body: null });

    await uploadFileItem({ typeName: "image", folderId: null }, input, file, vi.fn());

    expect(sentForm().has("folderId")).toBe(false);
  });

  it("returns a generic error for a reply that isn't JSON", async () => {
    vi.mocked(postFormWithProgress).mockResolvedValue({ status: 502, body: null });

    expect(await uploadFileItem({ typeName: "file", folderId: null }, input, file, vi.fn())).toEqual({
      success: false,
      data: null,
      error: ITEM_CREATE_FAILED,
      fieldErrors: {},
    });
  });

  it("returns a connection error instead of throwing when the request never gets a reply", async () => {
    vi.mocked(postFormWithProgress).mockRejectedValue(new Error("Upload failed: network error"));

    expect(await uploadFileItem({ typeName: "file", folderId: null }, input, file, vi.fn())).toEqual({
      success: false,
      data: null,
      error: CONNECTION_FAILED,
      fieldErrors: {},
    });
  });
});
