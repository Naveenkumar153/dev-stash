import type { Session } from "next-auth";
import { describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  canCreateItem,
  createCollectionWithinLimit,
  createItemWithinLimit,
  getSessionEntitlements,
  getUsage,
  isProGatingEnabled,
} from "@/lib/usage-limits";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { item: { count: vi.fn() }, collection: { count: vi.fn() }, $transaction: vi.fn() },
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

describe("createItemWithinLimit / createCollectionWithinLimit", () => {
  const create = vi.fn();

  function runTransactions() {
    vi.mocked(prisma.$transaction).mockImplementation((async (run: (tx: unknown) => unknown) =>
      run(prisma)) as never);
  }

  function serializationFailure() {
    return new Prisma.PrismaClientKnownRequestError("could not serialize access", {
      code: "P2034",
      clientVersion: "7",
    });
  }

  it("creates with access without a count or a transaction", async () => {
    create.mockResolvedValue("created");

    expect(await createItemWithinLimit("user-1", true, create)).toEqual({
      allowed: true,
      value: "created",
    });
    expect(create).toHaveBeenCalledWith(prisma);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("counts and creates in one serializable transaction under the limit", async () => {
    runTransactions();
    vi.mocked(prisma.item.count).mockResolvedValue(49);
    create.mockResolvedValue("created");

    expect(await createItemWithinLimit("user-1", false, create)).toEqual({
      allowed: true,
      value: "created",
    });
    expect(prisma.item.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("refuses at the item limit without creating", async () => {
    runTransactions();
    vi.mocked(prisma.item.count).mockResolvedValue(50);

    expect(await createItemWithinLimit("user-1", false, create)).toEqual({
      allowed: false,
      limit: 50,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [2, true],
    [3, false],
    [4, false],
  ])("for collections, at %i existing allows: %s", async (existing, allowed) => {
    runTransactions();
    vi.mocked(prisma.collection.count).mockResolvedValue(existing);
    create.mockResolvedValue("created");

    expect((await createCollectionWithinLimit("user-1", false, create)).allowed).toBe(allowed);
    expect(prisma.collection.count).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("retries once when Postgres aborts the transaction for a concurrent create", async () => {
    vi.mocked(prisma.$transaction)
      .mockRejectedValueOnce(serializationFailure())
      .mockImplementationOnce((async (run: (tx: unknown) => unknown) => run(prisma)) as never);
    // The retry sees the row the concurrent winner committed.
    vi.mocked(prisma.collection.count).mockResolvedValue(3);

    expect(await createCollectionWithinLimit("user-1", false, create)).toEqual({
      allowed: false,
      limit: 3,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry is aborted too", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(serializationFailure());

    await expect(createCollectionWithinLimit("user-1", false, create)).rejects.toMatchObject({
      code: "P2034",
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry other failures", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

    await expect(createItemWithinLimit("user-1", false, create)).rejects.toThrow("connection lost");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
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
