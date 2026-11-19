import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { checkPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

// `auth.ts` builds its instance at import; the stub captures the config so the
// `jwt` callback can be called without the NextAuth runtime.
const captured = vi.hoisted(() => ({ config: undefined as NextAuthConfig | undefined }));

vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    captured.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
  CredentialsSignin: class extends Error {},
}));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: vi.fn() } } }));
vi.mock("@/lib/password", () => ({ checkPassword: vi.fn() }));
vi.mock("@/lib/verification", () => ({ isEmailVerificationEnabled: () => false }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: vi.fn(), rateLimit: vi.fn() }));

type JwtCallback = (params: { token: JWT; user?: { id?: string } }) => Promise<JWT>;
type Authorize = (input: Record<string, unknown>, request: Request) => Promise<unknown>;

let jwt: JwtCallback;
let authorize: Authorize;

beforeAll(async () => {
  await import("@/auth");
  jwt = captured.config?.callbacks?.jwt as unknown as JwtCallback;
  // The real Credentials provider keeps the config's authorize under `options`.
  const providers = (captured.config?.providers ?? []) as unknown as {
    id?: string;
    options?: { authorize?: Authorize };
  }[];
  authorize = providers.find((provider) => provider.id === "credentials")!.options!.authorize!;
});

describe("credentials authorize", () => {
  const request = new Request("http://localhost/api/auth/callback/credentials");
  const input = { email: "Ada@Example.com", password: "correct-horse" };
  const allowed = { success: true, remaining: 4, reset: 0 };

  function useUser(passwordHash: string | null) {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
      passwordHash,
      emailVerified: new Date(),
    } as never);
  }

  beforeEach(() => {
    vi.mocked(getClientIp).mockReturnValue("203.0.113.7");
    vi.mocked(rateLimit).mockResolvedValue(allowed);
  });

  it("signs in with the right password", async () => {
    useUser("stored-hash");
    vi.mocked(checkPassword).mockResolvedValue(true);

    expect(await authorize(input, request)).toEqual({
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      image: null,
    });
    expect(checkPassword).toHaveBeenCalledWith("correct-horse", "stored-hash");
  });

  it("counts the attempt per IP + email and per email alone", async () => {
    useUser("stored-hash");
    vi.mocked(checkPassword).mockResolvedValue(true);

    await authorize(input, request);

    expect(rateLimit).toHaveBeenCalledWith("signIn", "203.0.113.7:ada@example.com");
    expect(rateLimit).toHaveBeenCalledWith("signInEmail", "ada@example.com");
  });

  it("blocks when the per-email limit is spent, even from a fresh IP", async () => {
    vi.mocked(rateLimit).mockImplementation(async (name) =>
      name === "signInEmail" ? { success: false, remaining: 0, reset: 5000 } : allowed,
    );

    await expect(authorize(input, request)).rejects.toMatchObject({
      code: "rate_limited",
      reset: 5000,
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(checkPassword).not.toHaveBeenCalled();
  });

  it("retries when both limits allow again, so the later reset wins", async () => {
    vi.mocked(rateLimit).mockImplementation(async (name) =>
      name === "signIn"
        ? { success: false, remaining: 0, reset: 9000 }
        : { success: false, remaining: 0, reset: 4000 },
    );

    await expect(authorize(input, request)).rejects.toMatchObject({ reset: 9000 });
  });

  it("still runs one password compare for an unknown email", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(checkPassword).mockResolvedValue(false);

    expect(await authorize(input, request)).toBeNull();
    expect(checkPassword).toHaveBeenCalledWith("correct-horse", null);
  });

  it("still runs one password compare for a GitHub-only account", async () => {
    useUser(null);
    vi.mocked(checkPassword).mockResolvedValue(false);

    expect(await authorize(input, request)).toBeNull();
    expect(checkPassword).toHaveBeenCalledWith("correct-horse", null);
  });

  it("refuses a wrong password", async () => {
    useUser("stored-hash");
    vi.mocked(checkPassword).mockResolvedValue(false);

    expect(await authorize(input, request)).toBeNull();
  });

  it("refuses invalid input without counting an attempt", async () => {
    expect(await authorize({ email: "not-an-email", password: "" }, request)).toBeNull();
    expect(rateLimit).not.toHaveBeenCalled();
  });
});

describe("jwt callback", () => {
  it("keeps the shared session callback", () => {
    expect(captured.config?.callbacks?.session).toBeTypeOf("function");
  });

  it("re-reads isPro from the database on every validation", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: true, sessionVersion: 0 } as never);

    expect(await jwt({ token: { sub: "user-1", isPro: false } })).toEqual({
      sub: "user-1",
      isPro: true,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { isPro: true, sessionVersion: true },
    });
  });

  it("ends a session issued before the password was reset or changed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false, sessionVersion: 2 } as never);

    expect(await jwt({ token: { sub: "user-1", sessionVersion: 1 } })).toBeNull();
  });

  it("keeps a token without a version (issued before versions existed) at version 0", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false, sessionVersion: 0 } as never);

    expect(await jwt({ token: { sub: "user-1" } })).toMatchObject({ sub: "user-1", isPro: false });
  });

  it("ends a version-less token once the password has changed", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false, sessionVersion: 1 } as never);

    expect(await jwt({ token: { sub: "user-1" } })).toBeNull();
  });

  it("records the current version on sign-in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: true, sessionVersion: 3 } as never);

    expect(await jwt({ token: {}, user: { id: "user-1" } })).toEqual({
      sub: "user-1",
      isPro: true,
      sessionVersion: 3,
    });
  });

  it("revokes a stale Pro token when the database says Free", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false, sessionVersion: 0 } as never);

    expect(await jwt({ token: { sub: "user-1", isPro: true } })).toMatchObject({ isPro: false });
  });

  it("sets the subject from the user on sign-in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false, sessionVersion: 0 } as never);

    expect(await jwt({ token: {}, user: { id: "user-2" } })).toEqual({
      sub: "user-2",
      isPro: false,
      sessionVersion: 0,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
      select: { isPro: true, sessionVersion: true },
    });
  });

  it("reads a deleted user as Free", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    expect(await jwt({ token: { sub: "user-1", isPro: true } })).toMatchObject({ isPro: false });
  });

  it("skips the query without a subject", async () => {
    expect(await jwt({ token: {} })).toEqual({});
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
