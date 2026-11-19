import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword, deleteAccount } from "@/actions/profile";
import { auth, signIn, signOut } from "@/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { deleteFile, listFileKeys } from "@/lib/r2";
import {
  cancelCustomerSubscriptions,
  cancelSubscription,
  clearSubscription,
} from "@/lib/db/billing";
import { rateLimit } from "@/lib/rate-limit";

// Server actions are tested with every outside dependency mocked: the session,
// the database, bcrypt and R2. Nothing here reaches a real service.
vi.mock("@/auth", () => ({ auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/r2", () => ({ deleteFile: vi.fn(), listFileKeys: vi.fn() }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({
  cancelCustomerSubscriptions: vi.fn(),
  cancelSubscription: vi.fn(),
  clearSubscription: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));
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
  mockAuth.mockResolvedValue({ user: { id, isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      passwordHash: "stored-hash",
    } as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(hashPassword).mockResolvedValue("new-hash");
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 4, reset: Date.now() });
  });

  it("counts each attempt against the user's changePassword limit", async () => {
    await changePassword(passwordForm());

    expect(rateLimit).toHaveBeenCalledWith("changePassword", "user-1");
  });

  it("refuses an attempt over the limit before checking the password", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    vi.mocked(rateLimit).mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 10 * 60 * 1000,
    });

    expect(await changePassword(passwordForm())).toEqual({
      success: false,
      data: null,
      error: "Too many attempts. Please try again in 10 minutes.",
      fieldErrors: {},
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("refuses the shared demo account, whose password is published", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "demo@devstash.io",
      passwordHash: "stored-hash",
    } as never);

    expect(await changePassword(passwordForm())).toEqual({
      success: false,
      data: null,
      error: "The demo account's password can't be changed.",
      fieldErrors: {},
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stores the hash of the new password when the current one matches", async () => {
    const result = await changePassword(passwordForm());

    expect(result).toEqual({ success: true, data: null, error: null, fieldErrors: {} });
    expect(verifyPassword).toHaveBeenCalledWith("old-password", "stored-hash");
    expect(hashPassword).toHaveBeenCalledWith("new-password");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      // The version bump ends every other session.
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
  });

  it("signs this browser back in with the new password so it isn't signed out too", async () => {
    await changePassword(passwordForm());

    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "ada@example.com",
      password: "new-password",
      redirect: false,
    });
    expect(vi.mocked(prisma.user.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(signIn).mock.invocationCallOrder[0],
    );
  });

  it("still reports the change when re-issuing the session fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(signIn).mockRejectedValue(new Error("sign-in failed"));

    expect(await changePassword(passwordForm())).toEqual({
      success: true,
      data: null,
      error: null,
      fieldErrors: {},
    });
    expect(log).toHaveBeenCalledWith(
      "Re-issuing the session after a password change failed",
      expect.any(Error),
    );
  });

  it("refuses a signed-out request before touching the database", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await changePassword(passwordForm());

    expect(result).toMatchObject({
      success: false,
      error: "Your session has expired. Sign in again.",
    });
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
    vi.mocked(listFileKeys).mockResolvedValue([]);
  });

  it("refuses a signed-out request", async () => {
    mockAuth.mockResolvedValue(null);

    await expect(deleteAccount()).resolves.toMatchObject({
      error: "Your session has expired. Sign in again.",
    });
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

  describe("with a Pro subscription", () => {
    const cancel = vi.mocked(cancelSubscription);

    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "ada@example.com",
        stripeSubscriptionId: "sub_1",
      } as never);
      vi.mocked(prisma.tag.findMany).mockResolvedValue([] as never);
    });

    it("cancels the subscription before deleting anything", async () => {
      cancel.mockResolvedValue();

      await deleteAccount();

      expect(cancel).toHaveBeenCalledWith("sub_1");
      expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(prisma.$transaction).mock.invocationCallOrder[0],
      );
      expect(signOut).toHaveBeenCalled();
    });

    it("deletes nothing and stays signed in when the cancel fails", async () => {
      cancel.mockRejectedValue(new Error("stripe down"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(deleteAccount()).resolves.toEqual({
        success: false,
        data: null,
        error: "Couldn't cancel your subscription. Please try again.",
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(signOut).not.toHaveBeenCalled();
    });
  });

  describe("with a Stripe customer", () => {
    beforeEach(() => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        email: "ada@example.com",
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
      } as never);
      vi.mocked(prisma.tag.findMany).mockResolvedValue([] as never);
    });

    it("cancels every live subscription of the customer, not only the stored one", async () => {
      vi.mocked(cancelCustomerSubscriptions).mockResolvedValue(2);

      await deleteAccount();

      expect(cancelCustomerSubscriptions).toHaveBeenCalledWith("cus_1");
      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(vi.mocked(cancelCustomerSubscriptions).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(prisma.$transaction).mock.invocationCallOrder[0],
      );
      expect(signOut).toHaveBeenCalled();
    });

    it("ends Pro and says the subscription was canceled when the delete then fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(cancelCustomerSubscriptions).mockResolvedValue(1);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

      expect(await deleteAccount()).toEqual({
        success: false,
        data: null,
        error:
          "Your subscription was canceled, but your account couldn't be deleted. Please try again.",
      });
      expect(clearSubscription).toHaveBeenCalledWith("user-1");
      expect(signOut).not.toHaveBeenCalled();
    });

    it("still reports the canceled subscription when recording it fails too", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(cancelCustomerSubscriptions).mockResolvedValue(1);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));
      vi.mocked(clearSubscription).mockRejectedValue(new Error("still down"));

      expect(await deleteAccount()).toMatchObject({
        error:
          "Your subscription was canceled, but your account couldn't be deleted. Please try again.",
      });
    });

    it("gives the plain delete error when nothing was live to cancel", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(cancelCustomerSubscriptions).mockResolvedValue(0);
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

      expect(await deleteAccount()).toMatchObject({
        error: "Could not delete your account. Please try again.",
      });
      expect(clearSubscription).not.toHaveBeenCalled();
    });
  });

  it("doesn't call Stripe without a subscription", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      stripeSubscriptionId: null,
    } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([] as never);

    await deleteAccount();

    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledOnce();
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
    expect(listFileKeys).not.toHaveBeenCalled();
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("removes the user's stored files once the rows are gone, then signs out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
    vi.mocked(listFileKeys).mockResolvedValue(["user-1/a-diagram.png", "user-1/b-notes.md"]);

    await deleteAccount();

    // Listed by the user's key prefix only after the commit, so an upload whose
    // row landed while the delete ran is caught too.
    expect(listFileKeys).toHaveBeenCalledWith("user-1/");
    expect(vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(listFileKeys).mock.invocationCallOrder[0],
    );
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile).toHaveBeenCalledWith("user-1/a-diagram.png");
    expect(deleteFile).toHaveBeenCalledWith("user-1/b-notes.md");
    expect(vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deleteFile).mock.invocationCallOrder[0],
    );
    expect(vi.mocked(deleteFile).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(signOut).mock.invocationCallOrder[0],
    );
  });

  it("still deletes the account and signs out when removing a file fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
    vi.mocked(listFileKeys).mockResolvedValue(["user-1/a-diagram.png", "user-1/b-notes.md"]);
    vi.mocked(deleteFile).mockRejectedValueOnce(new Error("R2 unavailable"));

    await deleteAccount();

    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(
      "Discarding stored file failed",
      expect.objectContaining({ key: "user-1/a-diagram.png" }),
    );
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in?deleted=1" });
  });

  it("still signs out when listing the stored files fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
    vi.mocked(prisma.tag.findMany).mockResolvedValue([]);
    vi.mocked(listFileKeys).mockRejectedValue(new Error("R2 unavailable"));

    await deleteAccount();

    expect(deleteFile).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "Listing stored files failed",
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/sign-in?deleted=1" });
  });
});
