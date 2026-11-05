import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword, deleteAccount } from "@/actions/profile";
import { auth, signOut } from "@/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

// Server actions are tested with every outside dependency mocked: the session,
// the database and bcrypt. Nothing here reaches a real service.
vi.mock("@/auth", () => ({ auth: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    item: { deleteMany: vi.fn() },
    tag: { findMany: vi.fn(), deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

/**
 * `auth` is overloaded (it doubles as middleware), so its mock is typed by
 * hand as the session getter the actions call.
 */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

function signInAs(id: string) {
  mockAuth.mockResolvedValue({ user: { id }, expires: "2099-01-01T00:00:00.000Z" });
}

function passwordForm(fields: Partial<Record<string, string>> = {}) {
  const form = new FormData();
  const values = {
    currentPassword: "old-password",
    password: "new-password",
    confirmPassword: "new-password",
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      form.set(key, value);
    }
  }
  return form;
}

describe("changePassword", () => {
  beforeEach(() => {
    signInAs("user-1");
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: "stored-hash" } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue("new-hash");
  });

  it("stores the hash of the new password when the current one matches", async () => {
    const result = await changePassword(passwordForm());

    expect(result).toEqual({ success: true, data: null, error: null, fieldErrors: {} });
    expect(verifyPassword).toHaveBeenCalledWith("old-password", "stored-hash");
    expect(hashPassword).toHaveBeenCalledWith("new-password");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "new-hash" },
    });
  });

  it("refuses a signed-out request before touching the database", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await changePassword(passwordForm());

    expect(result).toMatchObject({ success: false, error: "You are not signed in." });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without checking the password", async () => {
    const result = await changePassword(passwordForm({ confirmPassword: "different" }));

    expect(result).toMatchObject({
      success: false,
      error: null,
      fieldErrors: { confirmPassword: "Passwords do not match" },
    });
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("puts a wrong current password on the currentPassword field", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const result = await changePassword(passwordForm());

    expect(result).toMatchObject({
      success: false,
      fieldErrors: { currentPassword: "Current password is incorrect" },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("turns away a GitHub-only account, which has no password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ passwordHash: null } as never);

    const result = await changePassword(passwordForm());

    expect(result).toMatchObject({
      success: false,
      error: "This account signs in with GitHub and has no password to change.",
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("returns a generic error when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("connection lost"));

    const result = await changePassword(passwordForm());

    expect(result).toMatchObject({
      success: false,
      error: "Could not change your password. Please try again.",
    });
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    signInAs("user-1");
  });

  it("refuses a signed-out request", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(deleteAccount()).resolves.toMatchObject({ error: "You are not signed in." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to delete the demo account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "demo@devstash.io" } as never);

    await expect(deleteAccount()).resolves.toMatchObject({
      error: "The demo account can't be deleted.",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("deletes everything in one transaction, then signs out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([{ id: "tag-1" }] as never);

    await deleteAccount();

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: ["ada@example.com", "password-reset:ada@example.com"] } },
    });
    expect(prisma.tag.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tag-1"] }, items: { none: {} } },
    });
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in?deleted=1" });
  });

  it("stays signed in when the transaction fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

    await expect(deleteAccount()).resolves.toMatchObject({
      error: "Could not delete your account. Please try again.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });
});
