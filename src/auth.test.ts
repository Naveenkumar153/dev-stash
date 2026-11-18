import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/prisma";

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
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ getClientIp: vi.fn(), rateLimit: vi.fn() }));

type JwtCallback = (params: { token: JWT; user?: { id?: string } }) => Promise<JWT>;

let jwt: JwtCallback;

beforeAll(async () => {
  await import("@/auth");
  jwt = captured.config?.callbacks?.jwt as unknown as JwtCallback;
});

describe("jwt callback", () => {
  it("keeps the shared session callback", () => {
    expect(captured.config?.callbacks?.session).toBeTypeOf("function");
  });

  it("re-reads isPro from the database on every validation", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: true } as never);

    expect(await jwt({ token: { sub: "user-1", isPro: false } })).toEqual({
      sub: "user-1",
      isPro: true,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { isPro: true },
    });
  });

  it("revokes a stale Pro token when the database says Free", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false } as never);

    expect(await jwt({ token: { sub: "user-1", isPro: true } })).toMatchObject({ isPro: false });
  });

  it("sets the subject from the user on sign-in", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ isPro: false } as never);

    expect(await jwt({ token: {}, user: { id: "user-2" } })).toEqual({
      sub: "user-2",
      isPro: false,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
      select: { isPro: true },
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
