import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { getEditorPreferences } from "@/lib/db/editor-preferences";
import { DEFAULT_EDITOR_PREFERENCES } from "@/lib/editor-preferences";
import { prisma } from "@/lib/prisma";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

describe("getEditorPreferences", () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
  });

  it("reads the session user's stored preferences, filling gaps with defaults", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      editorPreferences: { theme: "github-dark", fontSize: 99 },
    } as never);

    expect(await getEditorPreferences()).toEqual({
      ...DEFAULT_EDITOR_PREFERENCES,
      theme: "github-dark",
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { editorPreferences: true },
    });
  });

  it("gives the defaults when signed out, without a query", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await getEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("gives the defaults when the session outlived its user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    expect(await getEditorPreferences()).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });
});
