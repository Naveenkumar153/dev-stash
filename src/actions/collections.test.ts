import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCollection } from "@/actions/collections";
import { auth } from "@/auth";
import { createCollection as createCollectionRecord, type CollectionSummary } from "@/lib/db/collections";

// The session and the query are mocked; the Zod schema runs for real, so these
// tests also cover what the action sends to the database.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/collections", () => ({ createCollection: vi.fn() }));

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
