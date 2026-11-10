import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateItem } from "@/actions/items";
import { auth } from "@/auth";
import { updateItem as updateItemRecord } from "@/lib/db/items";
import type { ItemDetail } from "@/types/items";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/items", () => ({ updateItem: vi.fn() }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const ITEM_ID = "cmtg169y00002zzx5wxanksok";
const NOT_FOUND = "This item doesn't exist or has been deleted.";

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
};

const saved: ItemDetail = {
  id: ITEM_ID,
  title: "useDebounce hook",
  description: null,
  contentType: "text",
  content: "export function useDebounce() {}",
  url: null,
  language: "typescript",
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
    vi.mocked(updateItemRecord).mockResolvedValue(saved);
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
    vi.mocked(updateItemRecord).mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, input)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
      fieldErrors: {},
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
