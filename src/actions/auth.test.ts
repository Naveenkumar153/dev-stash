import { beforeEach, describe, expect, it, vi } from "vitest";

import { resendVerificationEmail } from "@/actions/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isEmailVerificationEnabled, issueVerificationEmail } from "@/lib/verification";

vi.mock("next-auth", () => ({
  AuthError: class extends Error {},
  CredentialsSignin: class extends Error {},
}));
vi.mock("@/auth", () => ({ signIn: vi.fn(), signOut: vi.fn(), TooManyAttempts: class {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/password-reset", () => ({
  issuePasswordResetEmail: vi.fn(),
  resetPasswordWithToken: vi.fn(),
}));
vi.mock("@/lib/verification", () => ({
  isEmailVerificationEnabled: vi.fn(),
  issueVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));

const SUCCESS = { success: true, data: null, error: null };

describe("resendVerificationEmail", () => {
  beforeEach(() => {
    vi.mocked(isEmailVerificationEnabled).mockReturnValue(true);
    vi.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 2, reset: 0 });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Ada",
      passwordHash: "hash",
      emailVerified: null,
    } as never);
    vi.mocked(issueVerificationEmail).mockResolvedValue(true);
  });

  it("sends to an unverified credentials account", async () => {
    expect(await resendVerificationEmail("ada@example.com")).toEqual(SUCCESS);
    expect(issueVerificationEmail).toHaveBeenCalledWith("ada@example.com", "Ada");
  });

  it("gives the same reply inside the cooldown, so it can't reveal the account", async () => {
    vi.mocked(issueVerificationEmail).mockResolvedValue(false);

    expect(await resendVerificationEmail("ada@example.com")).toEqual(SUCCESS);
  });

  it("gives the same reply when the send fails, logging it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(issueVerificationEmail).mockRejectedValue(new Error("resend down"));

    expect(await resendVerificationEmail("ada@example.com")).toEqual(SUCCESS);
    expect(log).toHaveBeenCalled();
  });

  it("gives the same reply for an unknown email, sending nothing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    expect(await resendVerificationEmail("nobody@example.com")).toEqual(SUCCESS);
    expect(issueVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends nothing to a verified account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      name: "Ada",
      passwordHash: "hash",
      emailVerified: new Date(),
    } as never);

    expect(await resendVerificationEmail("ada@example.com")).toEqual(SUCCESS);
    expect(issueVerificationEmail).not.toHaveBeenCalled();
  });

  it("refuses an invalid email", async () => {
    expect(await resendVerificationEmail("not-an-email")).toMatchObject({ success: false });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
