import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canCreateCollection,
  canCreateItem,
  getSessionEntitlements,
  getUsage,
  isProGatingEnabled,
} from "@/lib/usage-limits";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { count: vi.fn() }, collection: { count: vi.fn() } },
}));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

function signIn(user: Partial<Session["user"]>) {
  mockAuth.mockResolvedValue({
    user: { id: "user-1", ...user },
    expires: "2099-01-01T00:00:00.000Z",
  } as Session);
}

describe("isProGatingEnabled", () => {
  it('is on only for the exact string "true"', () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    expect(isProGatingEnabled()).toBe(true);
  });

  it("is off when unset", () => {
    expect(isProGatingEnabled()).toBe(false);
  });

  it.each(["", "TRUE", "True", "1", " true", "true ", "yes", "false"])(
    "is off for %j",
    (value) => {
      vi.stubEnv("PRO_GATING_ENABLED", value);
      expect(isProGatingEnabled()).toBe(false);
    },
  );
});

describe("getSessionEntitlements", () => {
  it("is null when signed out", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await getSessionEntitlements()).toBeNull();
  });

  it("is null for a session without a user id", async () => {
    mockAuth.mockResolvedValue({ user: {}, expires: "2099-01-01T00:00:00.000Z" } as Session);
    expect(await getSessionEntitlements()).toBeNull();
  });

  it.each([
    ["on", "true"],
    ["off", undefined],
  ])("gives a Pro user access with gating %s", async (_label, flag) => {
    if (flag) vi.stubEnv("PRO_GATING_ENABLED", flag);
    signIn({ isPro: true });

    expect(await getSessionEntitlements()).toEqual({
      userId: "user-1",
      isPro: true,
      hasProAccess: true,
    });
  });

  it("gives a Free user access while gating is off", async () => {
    signIn({ isPro: false });

    expect(await getSessionEntitlements()).toEqual({
      userId: "user-1",
      isPro: false,
      hasProAccess: true,
    });
  });

  it("withholds access from a Free user while gating is on", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    signIn({ isPro: false });

    expect(await getSessionEntitlements()).toEqual({
      userId: "user-1",
      isPro: false,
      hasProAccess: false,
    });
  });

  it("treats a session without isPro as Free", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    signIn({});

    expect(await getSessionEntitlements()).toEqual({
      userId: "user-1",
      isPro: false,
      hasProAccess: false,
    });
  });
});

describe("canCreateItem", () => {
  it("allows without counting when the user has access", async () => {
    expect(await canCreateItem("user-1", true)).toEqual({ allowed: true });
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it.each([0, 49])("allows a Free user at %i items", async (count) => {
    vi.mocked(prisma.item.count).mockResolvedValue(count);
    expect(await canCreateItem("user-1", false)).toEqual({ allowed: true });
  });

  it.each([50, 51])("refuses a Free user at %i items", async (count) => {
    vi.mocked(prisma.item.count).mockResolvedValue(count);
    expect(await canCreateItem("user-1", false)).toEqual({ allowed: false, limit: 50 });
  });

  it("counts only the given user's items", async () => {
    vi.mocked(prisma.item.count).mockResolvedValue(0);
    await canCreateItem("user-1", false);

    expect(prisma.item.count).toHaveBeenCalledTimes(1);
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("rejects when the count fails", async () => {
    vi.mocked(prisma.item.count).mockRejectedValue(new Error("db down"));
    await expect(canCreateItem("user-1", false)).rejects.toThrow("db down");
  });
});

describe("canCreateCollection", () => {
  it("allows without counting when the user has access", async () => {
    expect(await canCreateCollection("user-1", true)).toEqual({ allowed: true });
    expect(prisma.collection.count).not.toHaveBeenCalled();
  });

  it.each([0, 2])("allows a Free user at %i collections", async (count) => {
    vi.mocked(prisma.collection.count).mockResolvedValue(count);
    expect(await canCreateCollection("user-1", false)).toEqual({ allowed: true });
  });

  it.each([3, 4])("refuses a Free user at %i collections", async (count) => {
    vi.mocked(prisma.collection.count).mockResolvedValue(count);
    expect(await canCreateCollection("user-1", false)).toEqual({ allowed: false, limit: 3 });
  });

  it("counts only the given user's collections", async () => {
    vi.mocked(prisma.collection.count).mockResolvedValue(0);
    await canCreateCollection("user-1", false);

    expect(prisma.collection.count).toHaveBeenCalledTimes(1);
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});

describe("getUsage", () => {
  it("counts the user's items and collections", async () => {
    vi.mocked(prisma.item.count).mockResolvedValue(12);
    vi.mocked(prisma.collection.count).mockResolvedValue(2);

    expect(await getUsage("user-1")).toEqual({ items: 12, collections: 2 });
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("rejects when a count fails", async () => {
    vi.mocked(prisma.item.count).mockResolvedValue(12);
    vi.mocked(prisma.collection.count).mockRejectedValue(new Error("db down"));

    await expect(getUsage("user-1")).rejects.toThrow("db down");
  });
});
