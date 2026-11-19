import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/register/route";
import { Prisma } from "@/generated/prisma/client";
import { sendAccountExistsEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isEmailVerificationEnabled, issueVerificationEmail } from "@/lib/verification";

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn(), create: vi.fn() } } }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendAccountExistsEmail: vi.fn() }));
vi.mock("@/lib/verification", () => ({
  isEmailVerificationEnabled: vi.fn(),
  issueVerificationEmail: vi.fn(),
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: vi.fn(),
}));

const ALLOWED = { success: true, remaining: 2, reset: 0 };
const form = { name: "Ada", email: "Ada@Example.com", password: "password123", confirmPassword: "password123" };

async function register(body: unknown = form) {
  const response = await POST(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

const CHECK_YOUR_EMAIL = {
  status: 201,
  body: {
    success: true,
    data: { name: "Ada", email: "ada@example.com", verificationRequired: true },
    error: null,
  },
};

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.mocked(rateLimit).mockResolvedValue(ALLOWED);
    vi.mocked(hashPassword).mockResolvedValue("hash");
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({ name: "Ada", email: "ada@example.com" } as never);
    vi.mocked(isEmailVerificationEnabled).mockReturnValue(true);
  });

  describe("with verification on", () => {
    it("creates the account and sends the verification email", async () => {
      expect(await register()).toEqual(CHECK_YOUR_EMAIL);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { name: "Ada", email: "ada@example.com", passwordHash: "hash" },
        select: { name: true, email: true },
      });
      expect(issueVerificationEmail).toHaveBeenCalledWith("ada@example.com", "Ada");
    });

    it("gives a taken email the same reply, and mails its owner a notice instead", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);

      expect(await register()).toEqual(CHECK_YOUR_EMAIL);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(issueVerificationEmail).not.toHaveBeenCalled();
      expect(rateLimit).toHaveBeenCalledWith("accountExistsNotice", "ada@example.com");
      expect(sendAccountExistsEmail).toHaveBeenCalledWith({
        to: "ada@example.com",
        signInUrl: "http://localhost:3000/sign-in",
        resetUrl: "http://localhost:3000/forgot-password",
      });
    });

    it("hashes the password on both paths, so timing doesn't tell them apart", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);

      await register();

      expect(hashPassword).toHaveBeenCalledWith("password123");
    });

    it("sends at most one notice an hour per address, with the same reply", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(rateLimit).mockImplementation(async (name) =>
        name === "accountExistsNotice" ? { success: false, remaining: 0, reset: 0 } : ALLOWED,
      );

      expect(await register()).toEqual(CHECK_YOUR_EMAIL);
      expect(sendAccountExistsEmail).not.toHaveBeenCalled();
    });

    it("hides a failed notice behind the same reply, logging it", async () => {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);
      vi.mocked(sendAccountExistsEmail).mockRejectedValue(new Error("resend down"));

      expect(await register()).toEqual(CHECK_YOUR_EMAIL);
      expect(log).toHaveBeenCalledWith("Account-exists notice failed", expect.any(Error));
    });

    it("gives the same reply when a simultaneous sign-up took the email first", async () => {
      vi.mocked(prisma.user.create).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "7",
        }),
      );

      expect(await register()).toEqual(CHECK_YOUR_EMAIL);
    });
  });

  describe("with verification off", () => {
    beforeEach(() => {
      vi.mocked(isEmailVerificationEnabled).mockReturnValue(false);
    });

    it("creates the account for an immediate sign-in, sending nothing", async () => {
      expect(await register()).toEqual({
        status: 201,
        body: {
          success: true,
          data: { name: "Ada", email: "ada@example.com", verificationRequired: false },
          error: null,
        },
      });
      expect(issueVerificationEmail).not.toHaveBeenCalled();
    });

    it("says plainly that the email is taken, since there's no inbox step", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: "user-1" } as never);

      expect(await register()).toMatchObject({
        status: 409,
        body: { success: false, error: "An account with this email already exists" },
      });
      expect(sendAccountExistsEmail).not.toHaveBeenCalled();
    });
  });

  it("refuses invalid input before counting an attempt", async () => {
    expect((await register({ ...form, confirmPassword: "different1" })).status).toBe(400);
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("refuses an attempt over the per-IP limit with a 429", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, reset: Date.now() + 60_000 });

    expect((await register()).status).toBe(429);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
