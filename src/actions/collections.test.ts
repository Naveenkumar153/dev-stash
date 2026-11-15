import { refresh } from "next/cache";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCollection, deleteCollection, updateCollection } from "@/actions/collections";
import { auth } from "@/auth";
import {
  createCollection as createCollectionRecord,
  deleteCollection as deleteCollectionRecord,
  updateCollection as updateCollectionRecord,
  type CollectionSummary,
} from "@/lib/db/collections";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
}));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const created: CollectionSummary = {
  id: "cmtg169y00002zzx5wxanksok",
  name: "React Patterns",
  description: "Hooks and components",
  isFavorite: false,
  itemCount: 0,
  dominantTypeName: null,
  typeNames: [],
};

describe("createCollection", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" });
    vi.mocked(createCollectionRecord).mockResolvedValue(created);
  });

  it("creates the normalized collection for the signed-in user and returns it", async () => {
    const result = await createCollection({
      name: "  React Patterns ",
      description: " Hooks and components  ",
    });

    expect(result).toEqual({ success: true, data: created, error: null, fieldErrors: {} });
    expect(createCollectionRecord).toHaveBeenCalledWith("user-1", {
      name: "React Patterns",
      description: "Hooks and components",
    });
  });

  it("saves a blank description as null", async () => {
    await createCollection({ name: "React Patterns", description: "   " });

    expect(createCollectionRecord).toHaveBeenCalledWith("user-1", {
      name: "React Patterns",
      description: null,
    });
  });

  it("refuses a signed-out request without writing", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createCollection({ name: "React Patterns", description: "" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
      fieldErrors: {},
    });
    expect(createCollectionRecord).not.toHaveBeenCalled();
  });

  it("returns the field error for invalid input without writing", async () => {
    const result = await createCollection({ name: "   ", description: "" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Name is required",
      fieldErrors: { name: "Name is required" },
    });
    expect(createCollectionRecord).not.toHaveBeenCalled();
  });

  it("returns a generic message when the database fails", async () => {
    vi.mocked(createCollectionRecord).mockRejectedValue(new Error("connection lost"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await createCollection({ name: "React Patterns", description: "" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Couldn't create this collection. Please try again.",
      fieldErrors: {},
    });
  });
});

const COLLECTION_ID = "cmtg169y00002zzx5wxanksok";
const SESSION = { user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" };

describe("updateCollection", () => {
  const saved = { id: COLLECTION_ID, name: "Hooks", description: null, isFavorite: true };

  beforeEach(() => {
    mockAuth.mockResolvedValue(SESSION);
    vi.mocked(updateCollectionRecord).mockResolvedValue(saved);
  });

  it("saves the normalized name and description for the signed-in user's collection", async () => {
    const result = await updateCollection(COLLECTION_ID, { name: "  Hooks ", description: "  " });

    expect(result).toEqual({ success: true, data: saved, error: null, fieldErrors: {} });
    expect(updateCollectionRecord).toHaveBeenCalledWith("user-1", COLLECTION_ID, {
      name: "Hooks",
      description: null,
    });
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateCollection(COLLECTION_ID, { name: "Hooks" });

    expect(result).toMatchObject({ success: false, error: "Your session has expired. Sign in again." });
    expect(updateCollectionRecord).not.toHaveBeenCalled();
  });

  it("treats a malformed id as not found, without a query", async () => {
    const result = await updateCollection("not-a-cuid", { name: "Hooks" });

    expect(result).toMatchObject({
      success: false,
      error: "This collection doesn't exist or has been deleted.",
    });
    expect(updateCollectionRecord).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input, without a query", async () => {
    const result = await updateCollection(COLLECTION_ID, { name: "   ", description: "x".repeat(501) });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Name is required",
      fieldErrors: {
        name: "Name is required",
        description: "Descriptions can be up to 500 characters",
      },
    });
    expect(updateCollectionRecord).not.toHaveBeenCalled();
  });

  it("reports not found for a missing or another user's collection", async () => {
    vi.mocked(updateCollectionRecord).mockResolvedValue(null);

    expect(await updateCollection(COLLECTION_ID, { name: "Hooks" })).toMatchObject({
      success: false,
      data: null,
      error: "This collection doesn't exist or has been deleted.",
    });
  });

  it("returns a generic error when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(updateCollectionRecord).mockRejectedValue(new Error("connection lost"));

    expect(await updateCollection(COLLECTION_ID, { name: "Hooks" })).toMatchObject({
      success: false,
      error: "Couldn't update this collection. Please try again.",
    });
  });
});

describe("deleteCollection", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue(SESSION);
    vi.mocked(deleteCollectionRecord).mockResolvedValue(true);
  });

  it("deletes the signed-in user's collection", async () => {
    expect(await deleteCollection(COLLECTION_ID)).toEqual({
      success: true,
      data: { id: COLLECTION_ID },
      error: null,
    });
    expect(deleteCollectionRecord).toHaveBeenCalledWith("user-1", COLLECTION_ID);
    // The page and sidebar re-render in the same response.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await deleteCollection(COLLECTION_ID)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(deleteCollectionRecord).not.toHaveBeenCalled();
  });

  it("treats a malformed id as not found, without a query", async () => {
    expect(await deleteCollection("not-a-cuid")).toMatchObject({
      success: false,
      error: "This collection doesn't exist or has been deleted.",
    });
    expect(deleteCollectionRecord).not.toHaveBeenCalled();
  });

  it("reports not found when nothing matched, without refreshing", async () => {
    vi.mocked(deleteCollectionRecord).mockResolvedValue(false);

    expect(await deleteCollection(COLLECTION_ID)).toMatchObject({
      success: false,
      error: "This collection doesn't exist or has been deleted.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns a generic error when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(deleteCollectionRecord).mockRejectedValue(new Error("connection lost"));

    expect(await deleteCollection(COLLECTION_ID)).toMatchObject({
      success: false,
      error: "Couldn't delete this collection. Please try again.",
    });
  });
});
