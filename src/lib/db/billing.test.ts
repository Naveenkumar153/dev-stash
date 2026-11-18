import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applySubscription,
  getBillingStatus,
  getOrCreateCustomerId,
  syncSubscription,
} from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const customersCreate = vi.hoisted(() => vi.fn());
const subscriptionsRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  getStripe: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getStripe).mockReturnValue({
    customers: { create: customersCreate },
    subscriptions: { retrieve: subscriptionsRetrieve },
  } as unknown as Stripe);
});

function subscription(
  status: Stripe.Subscription.Status,
  customer: Stripe.Subscription["customer"] | null = "cus_1",
): Stripe.Subscription {
  return { id: "sub_1", status, customer } as Stripe.Subscription;
}

describe("getBillingStatus", () => {
  it("reports the plan and whether a customer exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isPro: true,
      stripeCustomerId: "cus_1",
    } as never);

    expect(await getBillingStatus("user-1")).toEqual({ isPro: true, hasCustomer: true });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { isPro: true, stripeCustomerId: true },
    });
  });

  it("reports no customer for a user who never checked out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isPro: false,
      stripeCustomerId: null,
    } as never);

    expect(await getBillingStatus("user-1")).toEqual({ isPro: false, hasCustomer: false });
  });

  it("is null when the user is gone", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    expect(await getBillingStatus("user-1")).toBeNull();
  });
});

describe("getOrCreateCustomerId", () => {
  const user = { email: "a@example.com", name: "Ada", stripeCustomerId: null };

  it("returns a stored customer without calling Stripe", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      ...user,
      stripeCustomerId: "cus_saved",
    } as never);

    expect(await getOrCreateCustomerId("user-1")).toBe("cus_saved");
    expect(customersCreate).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("creates the customer idempotently and saves it only if none is stored", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(user as never);
    customersCreate.mockResolvedValue({ id: "cus_new" });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });

    expect(await getOrCreateCustomerId("user-1")).toBe("cus_new");
    expect(customersCreate).toHaveBeenCalledWith(
      { email: "a@example.com", name: "Ada", metadata: { userId: "user-1" } },
      { idempotencyKey: "customer-user-1" },
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", stripeCustomerId: null },
      data: { stripeCustomerId: "cus_new" },
    });
  });

  it("leaves the name out when the user has none", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ ...user, name: null } as never);
    customersCreate.mockResolvedValue({ id: "cus_new" });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });

    await getOrCreateCustomerId("user-1");
    expect(customersCreate.mock.calls[0][0]).toEqual({
      email: "a@example.com",
      name: undefined,
      metadata: { userId: "user-1" },
    });
  });

  it("returns the winner's id when a concurrent request saved first", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow)
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce({ stripeCustomerId: "cus_winner" } as never);
    customersCreate.mockResolvedValue({ id: "cus_loser" });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 });

    expect(await getOrCreateCustomerId("user-1")).toBe("cus_winner");
  });

  it("throws if no customer is stored after a lost save", async () => {
    vi.mocked(prisma.user.findUniqueOrThrow)
      .mockResolvedValueOnce(user as never)
      .mockResolvedValueOnce({ stripeCustomerId: null } as never);
    customersCreate.mockResolvedValue({ id: "cus_new" });
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 0 });

    await expect(getOrCreateCustomerId("user-1")).rejects.toThrow(
      "Couldn't save a Stripe customer for user user-1",
    );
  });
});

describe("applySubscription", () => {
  it.each(["active", "trialing", "past_due"] as const)(
    "grants Pro for %s, scoped by customer",
    async (status) => {
      await applySubscription(subscription(status));

      expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { stripeCustomerId: "cus_1" },
        data: { isPro: true, stripeSubscriptionId: "sub_1" },
      });
    },
  );

  it.each(["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)(
    "revokes Pro for %s only while it is the current subscription",
    async (status) => {
      await applySubscription(subscription(status));

      expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
        data: { isPro: false, stripeSubscriptionId: null },
      });
    },
  );

  it("reads the customer id from an expanded customer", async () => {
    await applySubscription(subscription("active", { id: "cus_2" } as Stripe.Customer));

    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stripeCustomerId: "cus_2" } }),
    );
  });

  it("writes nothing without a customer", async () => {
    await applySubscription(subscription("active", null));
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("syncSubscription", () => {
  it("applies the subscription as retrieved from Stripe", async () => {
    subscriptionsRetrieve.mockResolvedValue(subscription("canceled"));

    await syncSubscription("sub_1");

    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1" },
      data: { isPro: false, stripeSubscriptionId: null },
    });
  });

  it("writes nothing when Stripe fails", async () => {
    subscriptionsRetrieve.mockRejectedValue(new Error("stripe down"));

    await expect(syncSubscription("sub_1")).rejects.toThrow("stripe down");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});
