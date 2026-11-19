import { refresh } from "next/cache";
import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCollection,
  deleteCollection,
  setCollectionFavorite,
  updateCollection,
} from "@/actions/collections";
import { auth } from "@/auth";
import { COLLECTION_LIMIT_REACHED } from "@/lib/action-result";
import {
  createCollection as createCollectionRecord,
  deleteCollection as deleteCollectionRecord,
  setCollectionFavorite as setCollectionFavoriteRecord,
  updateCollection as updateCollectionRecord,
  type CollectionSummary,
} from "@/lib/db/collections";
import { prisma } from "@/lib/prisma";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  setCollectionFavorite: vi.fn(),
}));
// The real usage limits run against this count; with PRO_GATING_ENABLED unset
// (as in every test that doesn't stub it) nothing is counted.
vi.mock("@/lib/prisma", () => ({ prisma: { collection: { count: vi.fn() }, $transaction: vi.fn() } }));

/** Runs an interactive transaction's callback against the mocked client. */
function runTransactions() {
  vi.mocked(prisma.$transaction).mockImplementation((async (run: (tx: unknown) => unknown) =>
    run(prisma)) as never);
}

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
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
    vi.mocked(createCollectionRecord).mockResolvedValue(created);
    runTransactions();
  });

  it("creates the normalized collection for the signed-in user and returns it", async () => {
    const result = await createCollection({
      name: "  React Patterns ",
      description: " Hooks and components  ",
    });

    expect(result).toEqual({ success: true, data: created, error: null, fieldErrors: {} });
    expect(createCollectionRecord).toHaveBeenCalledWith(
      "user-1",
      { name: "React Patterns", description: "Hooks and components" },
      prisma,
    );
  });

  it("doesn't count collections while gating is off", async () => {
    await createCollection({ name: "React Patterns", description: "" });
    expect(prisma.collection.count).not.toHaveBeenCalled();
  });

  it("refuses a Free account at the collection limit without writing", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    vi.mocked(prisma.collection.count).mockResolvedValue(3);

    expect(await createCollection({ name: "React Patterns", description: "" })).toEqual({
      success: false,
      data: null,
      error: COLLECTION_LIMIT_REACHED,
      fieldErrors: {},
    });
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(createCollectionRecord).not.toHaveBeenCalled();
  });

  it("creates for a Free account under the limit", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    vi.mocked(prisma.collection.count).mockResolvedValue(2);

    expect(await createCollection({ name: "React Patterns", description: "" })).toMatchObject({
      success: true,
    });
  });

  it("doesn't count collections for a Pro account while gating is on", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: true }, expires: "2099-01-01T00:00:00.000Z" });

    expect(await createCollection({ name: "React Patterns", description: "" })).toMatchObject({
      success: true,
    });
    expect(prisma.collection.count).not.toHaveBeenCalled();
  });

  it("saves a blank description as null", async () => {
    await createCollection({ name: "React Patterns", description: "   " });

    expect(createCollectionRecord).toHaveBeenCalledWith(
      "user-1",
      { name: "React Patterns", description: null },
      prisma,
    );
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
const SESSION = { user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" };

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

describe("setCollectionFavorite", () => {
  const FAILED = "Couldn't update favorites. Please try again.";
  const NOT_FOUND = "This collection doesn't exist or has been deleted.";

  beforeEach(() => {
    mockAuth.mockResolvedValue(SESSION);
    vi.mocked(setCollectionFavoriteRecord).mockResolvedValue(true);
  });

  it.each([true, false])("saves isFavorite = %s on the signed-in user's collection", async (isFavorite) => {
    expect(await setCollectionFavorite(COLLECTION_ID, isFavorite)).toEqual({
      success: true,
      data: { id: COLLECTION_ID, isFavorite },
      error: null,
    });
    expect(setCollectionFavoriteRecord).toHaveBeenCalledWith("user-1", COLLECTION_ID, isFavorite);
    // The cards, the sidebar's Favorites and /favorites re-render in the same response.
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("refuses when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await setCollectionFavorite(COLLECTION_ID, true)).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(setCollectionFavoriteRecord).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as not found, without a query", async () => {
    expect(await setCollectionFavorite("not-a-cuid", true)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(setCollectionFavoriteRecord).not.toHaveBeenCalled();
  });

  it("rejects a state that isn't a boolean, without a query", async () => {
    expect(await setCollectionFavorite(COLLECTION_ID, 1 as unknown as boolean)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(setCollectionFavoriteRecord).not.toHaveBeenCalled();
  });

  it("reports a missing or someone else's collection as not found, without refreshing", async () => {
    vi.mocked(setCollectionFavoriteRecord).mockResolvedValue(false);

    expect(await setCollectionFavorite(COLLECTION_ID, false)).toEqual({
      success: false,
      data: null,
      error: NOT_FOUND,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns a generic error when the write fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(setCollectionFavoriteRecord).mockRejectedValue(new Error("connection lost"));

    expect(await setCollectionFavorite(COLLECTION_ID, true)).toEqual({
      success: false,
      data: null,
      error: FAILED,
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
