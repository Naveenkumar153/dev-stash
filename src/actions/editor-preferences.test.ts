import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateEditorPreferences } from "@/actions/editor-preferences";
import { auth } from "@/auth";
import { EDITOR_PREFERENCES_SAVE_FAILED, SESSION_EXPIRED } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";

// The session and the database are mocked; the Zod schema runs for real.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const preferences = { fontSize: 16, tabSize: 4, wordWrap: false, minimap: true, theme: "monokai" };

describe("updateEditorPreferences", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" }, expires: "2099-01-01T00:00:00.000Z" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("saves the whole set on the signed-in user's row and returns it", async () => {
    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({ success: true, data: preferences, error: null, fieldErrors: {} });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { editorPreferences: preferences },
    });
  });

  it("writes only the known keys", async () => {
    await updateEditorPreferences({ ...preferences, isPro: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { editorPreferences: preferences },
    });
  });

  it("refuses when signed out, without validating or writing", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({ success: false, data: null, error: SESSION_EXPIRED, fieldErrors: {} });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid values and writes nothing", async () => {
    const result = await updateEditorPreferences({ ...preferences, fontSize: 40, theme: "light" });

    expect(result).toEqual({
      success: false,
      data: null,
      error: null,
      fieldErrors: {
        fontSize: "Choose a font size from the list",
        theme: "Choose a theme from the list",
      },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns a generic error when the write fails (e.g. the user was deleted)", async () => {
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("P2025"));

    const result = await updateEditorPreferences(preferences);

    expect(result).toEqual({
      success: false,
      data: null,
      error: EDITOR_PREFERENCES_SAVE_FAILED,
      fieldErrors: {},
    });
    expect(console.error).toHaveBeenCalled();
  });
});
