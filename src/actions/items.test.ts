import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createItem, deleteItem, updateItem } from "@/actions/items";
import { auth } from "@/auth";
import { ownsCollections } from "@/lib/db/collections";
import {
  createItem as createItemRecord,
  deleteItem as deleteItemRecord,
  updateItem as updateItemRecord,
} from "@/lib/db/items";
import { deleteFile } from "@/lib/r2";
import type { ItemDetail } from "@/types/items";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));
vi.mock("@/lib/r2", () => ({ deleteFile: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const ITEM_ID = "cmtg169y00002zzx5wxanksok";
const NOT_FOUND = "This item doesn't exist or has been deleted.";
const COLLECTIONS_NOT_FOUND = "One of these collections doesn't exist or has been deleted.";
const COLLECTION_A = "cmtg169y00004zzx5collect1";
const COLLECTION_B = "cmtg169y00005zzx5collect2";

function signInAs(id: string) {
  mockAuth.mockResolvedValue({ user: { id }, expires: "2099-01-01T00:00:00.000Z" });
}

const input = {
  title: "  useDebounce hook  ",
  description: "",
  content: "export function useDebounce() {}",
  language: " typescript ",
  url: "",
  tags: ["react", "react", "hooks"],
  collectionIds: [COLLECTION_A, COLLECTION_B, COLLECTION_A],
};

const saved: ItemDetail = {
  id: ITEM_ID,
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
  tags: ["hooks", "react"],
  collections: [],
  createdAt: "2026-08-30T10:00:00.000Z",
  updatedAt: "2026-11-10T12:30:00.000Z",
};

describe("updateItem", () => {
  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(updateItemRecord).mockResolvedValue({ status: "saved", item: saved });
    vi.mocked(ownsCollections).mockResolvedValue(true);
  });

  it("checks the chosen collections, each once, belong to the signed-in user", async () => {
    await updateItem(ITEM_ID, input);

    expect(ownsCollections).toHaveBeenCalledWith("user-1", [COLLECTION_A, COLLECTION_B]);
  });

  it("refuses a collection that isn't the user's, on the Collections field, without saving", async () => {
    vi.mocked(ownsCollections).mockResolvedValue(false);

    expect(await updateItem(ITEM_ID, input)).toEqual({
      success: false,
      data: null,
      error: COLLECTIONS_NOT_FOUND,
      fieldErrors: { collectionIds: COLLECTIONS_NOT_FOUND },
    });
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it("rejects a collection id that isn't a cuid without a query", async () => {
    const result = await updateItem(ITEM_ID, { ...input, collectionIds: ["not-an-id"] });

    expect(result.fieldErrors).toEqual({ collectionIds: "Choose collections from the list" });
    expect(ownsCollections).not.toHaveBeenCalled();
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it("saves the normalized payload for the signed-in user and returns the item", async () => {
    const result = await updateItem(ITEM_ID, input);

    expect(result).toEqual({ success: true, data: saved, error: null, fieldErrors: {} });
    expect(updateItemRecord).toHaveBeenCalledWith(ITEM_ID, "user-1", {
      title: "useDebounce hook",
      description: null,
      content: "export function useDebounce() {}",
      language: "typescript",
      url: null,
      tags: ["react", "hooks"],
      collectionIds: [COLLECTION_A, COLLECTION_B],
    });
  });

  it("refuses a signed-out request without saving", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, input)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
      fieldErrors: {},
    });
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found without saving", async () => {
    expect(await updateItem("../../users", input)).toMatchObject({ success: false, error: NOT_FOUND });
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it("returns the validation errors per field without saving", async () => {
    const result = await updateItem(ITEM_ID, { ...input, title: " ", url: "javascript:alert(1)" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Title is required",
      fieldErrors: {
        title: "Title is required",
        url: "Enter a full URL starting with http:// or https://",
      },
    });
    expect(updateItemRecord).not.toHaveBeenCalled();
  });

  it("reports someone else's item, or a missing one, as not found", async () => {
    vi.mocked(updateItemRecord).mockResolvedValue({ status: "not-found" });

    expect(await updateItem(ITEM_ID, input)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
      fieldErrors: {},
    });
  });

  it("shows a link losing its URL as an error on the URL field", async () => {
    vi.mocked(updateItemRecord).mockResolvedValue({ status: "url-required" });

    expect(await updateItem(ITEM_ID, { ...input, url: "" })).toEqual({
      success: false,
      data: null,
      error: "URL is required",
      fieldErrors: { url: "URL is required" },
    });
  });

  it("reports a database failure without passing on its details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(updateItemRecord).mockRejectedValue(new Error("connection reset"));

    expect(await updateItem(ITEM_ID, input)).toEqual({
      success: false,
      data: null,
      error: "Couldn't save your changes. Please try again.",
      fieldErrors: {},
    });
  });
});

describe("deleteItem", () => {
  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(deleteItemRecord).mockResolvedValue({ fileKey: null });
  });

  it("deletes the signed-in user's item and returns its id", async () => {
    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({ success: true, data: { id: ITEM_ID }, error: null });
    expect(deleteItemRecord).toHaveBeenCalledWith(ITEM_ID, "user-1");
  });

  it("refuses a signed-out request without deleting", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(deleteItemRecord).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found without deleting", async () => {
    const result = await deleteItem("not-an-id");

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND });
    expect(deleteItemRecord).not.toHaveBeenCalled();
  });

  it("reports someone else's item, or a missing one, as not found", async () => {
    vi.mocked(deleteItemRecord).mockResolvedValue(null);

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({ success: false, data: null, error: NOT_FOUND });
  });

  it("reports a database failure without passing on its details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteItemRecord).mockRejectedValue(new Error("connection reset by peer"));

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Couldn't delete this item. Please try again.",
    });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("leaves R2 alone for an item without a file", async () => {
    await deleteItem(ITEM_ID);

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("removes a file item's file from R2 after the row is gone", async () => {
    vi.mocked(deleteItemRecord).mockResolvedValue({ fileKey: "user-1/abc-notes.md" });

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({ success: true, data: { id: ITEM_ID }, error: null });
    expect(deleteFile).toHaveBeenCalledWith("user-1/abc-notes.md");
    expect(vi.mocked(deleteItemRecord).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteFile).mock.invocationCallOrder[0],
    );
  });

  it("still reports success when removing the file fails, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteItemRecord).mockResolvedValue({ fileKey: "user-1/abc-notes.md" });
    vi.mocked(deleteFile).mockRejectedValue(new Error("R2 unavailable"));

    const result = await deleteItem(ITEM_ID);

    expect(result).toEqual({ success: true, data: { id: ITEM_ID }, error: null });
    expect(log).toHaveBeenCalledWith(
      "Discarding stored file failed",
      expect.objectContaining({ key: "user-1/abc-notes.md" }),
    );
  });

  it("doesn't touch R2 when the item wasn't found", async () => {
    vi.mocked(deleteItemRecord).mockResolvedValue(null);

    await deleteItem(ITEM_ID);

    expect(deleteFile).not.toHaveBeenCalled();
  });
});

describe("createItem", () => {
  const newItem = { ...input, typeName: "snippet" } as const;

  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(createItemRecord).mockResolvedValue(saved);
    vi.mocked(ownsCollections).mockResolvedValue(true);
  });

  it("refuses a collection that isn't the user's, on the Collections field, without creating", async () => {
    vi.mocked(ownsCollections).mockResolvedValue(false);

    expect(await createItem(newItem)).toEqual({
      success: false,
      data: null,
      error: COLLECTIONS_NOT_FOUND,
      fieldErrors: { collectionIds: COLLECTIONS_NOT_FOUND },
    });
    expect(ownsCollections).toHaveBeenCalledWith("user-1", [COLLECTION_A, COLLECTION_B]);
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("reports a failed collection check without creating", async () => {
    vi.mocked(ownsCollections).mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createItem(newItem)).toMatchObject({
      success: false,
      error: "Couldn't create this item. Please try again.",
    });
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("creates the normalized item for the signed-in user and returns it", async () => {
    const result = await createItem(newItem);

    expect(result).toEqual({ success: true, data: saved, error: null, fieldErrors: {} });
    expect(createItemRecord).toHaveBeenCalledWith("user-1", {
      typeName: "snippet",
      title: "useDebounce hook",
      description: null,
      content: "export function useDebounce() {}",
      language: "typescript",
      url: null,
      tags: ["react", "hooks"],
      collectionIds: [COLLECTION_A, COLLECTION_B],
    });
  });

  it("refuses a signed-out request without creating", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await createItem(newItem)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
      fieldErrors: {},
    });
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("returns the validation errors per field without creating", async () => {
    const result = await createItem({ ...newItem, title: " ", typeName: "link", url: "" });

    expect(result).toMatchObject({
      success: false,
      data: null,
      error: "Title is required",
      fieldErrors: { title: "Title is required" },
    });
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("asks for a link's URL", async () => {
    expect(await createItem({ ...newItem, typeName: "link", url: "" })).toMatchObject({
      success: false,
      fieldErrors: { url: "URL is required" },
    });
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("refuses a Pro type sent by a crafted request", async () => {
    const result = await createItem({ ...newItem, typeName: "file" as "snippet" });

    expect(result).toMatchObject({ success: false, fieldErrors: { typeName: "Choose an item type" } });
    expect(createItemRecord).not.toHaveBeenCalled();
  });

  it("reports a missing system type", async () => {
    vi.mocked(createItemRecord).mockResolvedValue(null);

    expect(await createItem(newItem)).toEqual({
      success: false,
      data: null,
      error: "This item type isn't available.",
      fieldErrors: {},
    });
  });

  it("reports a database failure without passing on its details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createItemRecord).mockRejectedValue(new Error("connection reset"));

    expect(await createItem(newItem)).toEqual({
      success: false,
      data: null,
      error: "Couldn't create this item. Please try again.",
      fieldErrors: {},
    });
  });
});
