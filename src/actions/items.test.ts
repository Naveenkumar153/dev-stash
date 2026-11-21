import { refresh } from "next/cache";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createItem,
  deleteItem,
  setItemContent,
  setItemFavorite,
  toggleItemPin,
  updateItem,
} from "@/actions/items";
import { auth } from "@/auth";
import { ITEM_CREATE_FAILED, ITEM_LIMIT_REACHED } from "@/lib/action-result";
import { ownsCollections } from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";
import {
  createItem as createItemRecord,
  deleteItem as deleteItemRecord,
  setItemContent as setItemContentRecord,
  setItemFavorite as setItemFavoriteRecord,
  setItemPinned,
  updateItem as updateItemRecord,
} from "@/lib/db/item-writes";
import { deleteFile } from "@/lib/r2";
import type { ItemDetail } from "@/types/items";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/db/item-writes", () => ({ createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn(), setItemFavorite: vi.fn(), setItemPinned: vi.fn(), setItemContent: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteFile: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ ownsCollections: vi.fn() }));
// The real usage limits run against this count; with PRO_GATING_ENABLED unset
// (as in every test that doesn't stub it) nothing is counted.
vi.mock("@/lib/prisma", () => ({ prisma: { item: { count: vi.fn() }, $transaction: vi.fn() } }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const ITEM_ID = "cmtg169y00002zzx5wxanksok";
const NOT_FOUND = "This item doesn't exist or has been deleted.";
const COLLECTIONS_NOT_FOUND = "One of these collections doesn't exist or has been deleted.";
const COLLECTION_A = "cmtg169y00004zzx5collect1";
const COLLECTION_B = "cmtg169y00005zzx5collect2";

function signInAs(id: string) {
  mockAuth.mockResolvedValue({ user: { id, isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
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
    expect(refresh).toHaveBeenCalledOnce();
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
    expect(refresh).not.toHaveBeenCalled();
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
    expect(refresh).toHaveBeenCalledOnce();
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
    expect(refresh).not.toHaveBeenCalled();
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
    // A thumbnail is removed too in case the item was an image; a missing key is a no-op.
    expect(deleteFile).toHaveBeenCalledWith("user-1/abc-notes.md.thumb.webp");
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
    // Runs the interactive transaction's callback against the mocked client.
    vi.mocked(prisma.$transaction).mockImplementation((async (run: (tx: unknown) => unknown) =>
      run(prisma)) as never);
  });

  it("doesn't count items while gating is off", async () => {
    expect(await createItem(newItem)).toMatchObject({ success: true });
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("refuses a Free account at the item limit without creating", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    vi.mocked(prisma.item.count).mockResolvedValue(50);

    expect(await createItem(newItem)).toEqual({
      success: false,
      data: null,
      error: ITEM_LIMIT_REACHED,
      fieldErrors: {},
    });
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    // The count and the insert share one serializable transaction.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(createItemRecord).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("creates for a Free account under the limit", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    vi.mocked(prisma.item.count).mockResolvedValue(49);

    expect(await createItem(newItem)).toMatchObject({ success: true });
    // Written with the transaction's client, inside the same transaction as the count.
    expect(createItemRecord).toHaveBeenCalledWith("user-1", expect.anything(), prisma);
  });

  it("doesn't count items for a Pro account while gating is on", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: true }, expires: "2099-01-01T00:00:00.000Z" });

    expect(await createItem(newItem)).toMatchObject({ success: true });
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("reports a failed limit check without creating", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    vi.mocked(prisma.item.count).mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createItem(newItem)).toMatchObject({ success: false, error: ITEM_CREATE_FAILED });
    expect(createItemRecord).not.toHaveBeenCalled();
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
    expect(vi.mocked(createItemRecord).mock.calls[0][0]).toBe("user-1");
    expect(vi.mocked(createItemRecord).mock.calls[0][1]).toEqual({
      typeName: "snippet",
      title: "useDebounce hook",
      description: null,
      content: "export function useDebounce() {}",
      language: "typescript",
      url: null,
      tags: ["react", "hooks"],
      collectionIds: [COLLECTION_A, COLLECTION_B],
    });
    expect(refresh).toHaveBeenCalledOnce();
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

describe("setItemFavorite", () => {
  const FAILED = "Couldn't update favorites. Please try again.";

  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(setItemFavoriteRecord).mockResolvedValue(true);
  });

  it.each([true, false])("saves isFavorite = %s on the signed-in user's item", async (isFavorite) => {
    expect(await setItemFavorite(ITEM_ID, isFavorite)).toEqual({
      success: true,
      data: { id: ITEM_ID, isFavorite },
      error: null,
    });
    expect(setItemFavoriteRecord).toHaveBeenCalledWith("user-1", ITEM_ID, isFavorite);
    // The cards and /favorites re-render in the same response.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await setItemFavorite(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(setItemFavoriteRecord).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found, without a query", async () => {
    expect(await setItemFavorite("../etc", true)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(setItemFavoriteRecord).not.toHaveBeenCalled();
  });

  it("rejects a state that isn't a boolean, without a query", async () => {
    expect(await setItemFavorite(ITEM_ID, "true" as unknown as boolean)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(setItemFavoriteRecord).not.toHaveBeenCalled();
  });

  it("reports a missing or someone else's item as not found, without refreshing", async () => {
    vi.mocked(setItemFavoriteRecord).mockResolvedValue(false);

    expect(await setItemFavorite(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns a generic error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(setItemFavoriteRecord).mockRejectedValue(new Error("connection lost"));

    expect(await setItemFavorite(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("toggleItemPin", () => {
  const FAILED = "Couldn't update the pin. Please try again.";

  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(setItemPinned).mockResolvedValue(true);
  });

  it.each([true, false])("saves isPinned = %s on the signed-in user's item", async (isPinned) => {
    expect(await toggleItemPin(ITEM_ID, isPinned)).toEqual({
      success: true,
      data: { id: ITEM_ID, isPinned },
      error: null,
    });
    expect(setItemPinned).toHaveBeenCalledWith("user-1", ITEM_ID, isPinned);
    // The dashboard's Pinned section and the lists re-render in the same response.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await toggleItemPin(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(setItemPinned).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found, without a query", async () => {
    expect(await toggleItemPin("../etc", true)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(setItemPinned).not.toHaveBeenCalled();
  });

  it("rejects a state that isn't a boolean, without a query", async () => {
    expect(await toggleItemPin(ITEM_ID, "true" as unknown as boolean)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(setItemPinned).not.toHaveBeenCalled();
  });

  it("reports a missing or someone else's item as not found, without refreshing", async () => {
    vi.mocked(setItemPinned).mockResolvedValue(false);

    expect(await toggleItemPin(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns a generic error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(setItemPinned).mockRejectedValue(new Error("connection lost"));

    expect(await toggleItemPin(ITEM_ID, true)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("setItemContent", () => {
  const UPDATED = new Date("2026-11-21T12:00:00.000Z");

  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(setItemContentRecord).mockResolvedValue({ content: "Better prompt\n", updatedAt: UPDATED });
  });

  it("saves the content exactly as given and refreshes the pages", async () => {
    expect(await setItemContent(ITEM_ID, "Better prompt\n")).toEqual({
      success: true,
      data: { id: ITEM_ID, content: "Better prompt\n", updatedAt: "2026-11-21T12:00:00.000Z" },
      error: null,
    });
    expect(setItemContentRecord).toHaveBeenCalledWith("user-1", ITEM_ID, "Better prompt\n");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await setItemContent(ITEM_ID, "text")).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(setItemContentRecord).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found, without a query", async () => {
    expect(await setItemContent("../etc", "text")).toEqual({ success: false, data: null, error: NOT_FOUND });
    expect(setItemContentRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["blank", "  \n ", "Content can't be empty"],
    ["too long", "a".repeat(100_001), "Content can be up to 100,000 characters"],
  ])("rejects %s content without a query", async (_label, content, error) => {
    expect(await setItemContent(ITEM_ID, content)).toEqual({ success: false, data: null, error });
    expect(setItemContentRecord).not.toHaveBeenCalled();
  });

  it("answers not found for another user's item, a missing one or one without content", async () => {
    vi.mocked(setItemContentRecord).mockResolvedValue(null);

    expect(await setItemContent(ITEM_ID, "text")).toEqual({ success: false, data: null, error: NOT_FOUND });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("answers a generic failure when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(setItemContentRecord).mockRejectedValue(new Error("db down"));

    expect(await setItemContent(ITEM_ID, "text")).toEqual({
      success: false,
      data: null,
      error: "Couldn't save the prompt. Please try again.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
