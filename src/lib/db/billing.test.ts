import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applySubscription,
  cancelCustomerSubscriptions,
  cancelSubscription,
  clearSubscription,
  findLiveSubscriptionId,
  getBillingStatus,
  getOrCreateCustomerId,
  syncCheckoutForUser,
  syncSubscription,
} from "@/lib/db/billing";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const customersCreate = vi.hoisted(() => vi.fn());
const subscriptionsRetrieve = vi.hoisted(() => vi.fn());
const subscriptionsCancel = vi.hoisted(() => vi.fn());
const subscriptionsList = vi.hoisted(() => vi.fn());
const checkoutRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/stripe")>()),
  getStripe: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getStripe).mockReturnValue({
    customers: { create: customersCreate },
    subscriptions: {
      retrieve: subscriptionsRetrieve,
      cancel: subscriptionsCancel,
      list: subscriptionsList,
    },
    checkout: { sessions: { retrieve: checkoutRetrieve } },
  } as unknown as Stripe);
});

function subscription(
  status: Stripe.Subscription.Status,
  customer: Stripe.Subscription["customer"] | null = "cus_1",
  id = "sub_1",
): Stripe.Subscription {
  return { id, status, customer } as Stripe.Subscription;
}

function listed(...subscriptions: Stripe.Subscription[]) {
  return { data: subscriptions };
}

describe("getBillingStatus", () => {
  it("reports the plan and whether a customer exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      isPro: true,
      stripeCustomerId: "cus_1",
    } as never);

    expect(await getBillingStatus("user-1")).toEqual({
      isPro: true,
      hasCustomer: true,
      isDemo: false,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { email: true, isPro: true, stripeCustomerId: true },
    });
  });

  it("reports no customer for a user who never checked out", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "ada@example.com",
      isPro: false,
      stripeCustomerId: null,
    } as never);

    expect(await getBillingStatus("user-1")).toEqual({
      isPro: false,
      hasCustomer: false,
      isDemo: false,
    });
  });

  it("flags the shared demo account", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "demo@devstash.io",
      isPro: false,
      stripeCustomerId: null,
    } as never);

    expect(await getBillingStatus("user-1")).toMatchObject({ isDemo: true });
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

describe("syncCheckoutForUser", () => {
  const SESSION_ID = "cs_test_a1B2c3";

  beforeEach(() => {
    subscriptionsRetrieve.mockResolvedValue(subscription("active"));
  });

  it("syncs the subscription of the user's own checkout", async () => {
    checkoutRetrieve.mockResolvedValue({ client_reference_id: "user-1", subscription: "sub_1" });

    await syncCheckoutForUser("user-1", SESSION_ID);

    expect(checkoutRetrieve).toHaveBeenCalledWith(SESSION_ID);
    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_1" },
      data: { isPro: true, stripeSubscriptionId: "sub_1" },
    });
  });

  it("reads an expanded subscription's id", async () => {
    checkoutRetrieve.mockResolvedValue({ client_reference_id: "user-1", subscription: { id: "sub_1" } });

    await syncCheckoutForUser("user-1", SESSION_ID);

    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
  });

  it("ignores another user's checkout", async () => {
    checkoutRetrieve.mockResolvedValue({ client_reference_id: "user-2", subscription: "sub_1" });

    await syncCheckoutForUser("user-1", SESSION_ID);

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("ignores a checkout without a subscription", async () => {
    checkoutRetrieve.mockResolvedValue({ client_reference_id: "user-1", subscription: null });

    await syncCheckoutForUser("user-1", SESSION_ID);

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it.each(["{CHECKOUT_SESSION_ID}", "cs_", "sub_1", ""])(
    "makes no Stripe call for the malformed id %j",
    async (sessionId) => {
      await syncCheckoutForUser("user-1", sessionId);
      expect(checkoutRetrieve).not.toHaveBeenCalled();
    },
  );

  it("logs a Stripe failure instead of throwing", async () => {
    checkoutRetrieve.mockRejectedValue(new Error("stripe down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(syncCheckoutForUser("user-1", SESSION_ID)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("cancelSubscription", () => {
  it("cancels the subscription immediately", async () => {
    subscriptionsCancel.mockResolvedValue(subscription("canceled"));

    await cancelSubscription("sub_1");

    expect(subscriptionsCancel).toHaveBeenCalledWith("sub_1");
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
  });

  it.each(["canceled", "incomplete_expired"] as const)(
    "treats a refused cancel of a %s subscription as done",
    async (status) => {
      subscriptionsCancel.mockRejectedValue(new Error("already canceled"));
      subscriptionsRetrieve.mockResolvedValue(subscription(status));

      await expect(cancelSubscription("sub_1")).resolves.toBeUndefined();
      expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
    },
  );

  it("rethrows when the subscription is still live", async () => {
    subscriptionsCancel.mockRejectedValue(new Error("stripe down"));
    subscriptionsRetrieve.mockResolvedValue(subscription("active"));

    await expect(cancelSubscription("sub_1")).rejects.toThrow("stripe down");
  });

  it("rethrows the cancel error when the subscription can't be read either", async () => {
    subscriptionsCancel.mockRejectedValue(new Error("stripe down"));
    subscriptionsRetrieve.mockRejectedValue(new Error("still down"));

    await expect(cancelSubscription("sub_1")).rejects.toThrow("stripe down");
  });
});

describe("findLiveSubscriptionId", () => {
  it("lists every status and returns the first that hasn't ended", async () => {
    subscriptionsList.mockResolvedValue(
      listed(
        subscription("canceled", "cus_1", "sub_old"),
        subscription("incomplete_expired", "cus_1", "sub_expired"),
        subscription("incomplete", "cus_1", "sub_live"),
      ),
    );

    expect(await findLiveSubscriptionId("cus_1")).toBe("sub_live");
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_1", status: "all", limit: 100 });
  });

  it.each(["active", "trialing", "past_due", "unpaid", "paused"] as const)(
    "counts a %s subscription as live",
    async (status) => {
      subscriptionsList.mockResolvedValue(listed(subscription(status)));
      expect(await findLiveSubscriptionId("cus_1")).toBe("sub_1");
    },
  );

  it("is null when every subscription has ended", async () => {
    subscriptionsList.mockResolvedValue(listed(subscription("canceled")));
    expect(await findLiveSubscriptionId("cus_1")).toBeNull();
  });

  it("is null for a customer with no subscriptions", async () => {
    subscriptionsList.mockResolvedValue(listed());
    expect(await findLiveSubscriptionId("cus_1")).toBeNull();
  });
});

describe("cancelCustomerSubscriptions", () => {
  it("cancels every live subscription, skipping ended ones", async () => {
    subscriptionsList.mockResolvedValue(
      listed(
        subscription("active", "cus_1", "sub_monthly"),
        subscription("canceled", "cus_1", "sub_old"),
        subscription("trialing", "cus_1", "sub_yearly"),
      ),
    );
    subscriptionsCancel.mockResolvedValue(subscription("canceled"));

    expect(await cancelCustomerSubscriptions("cus_1")).toBe(2);
    expect(subscriptionsCancel.mock.calls).toEqual([["sub_monthly"], ["sub_yearly"]]);
  });

  it("cancels nothing for a customer with none live", async () => {
    subscriptionsList.mockResolvedValue(listed(subscription("canceled")));

    expect(await cancelCustomerSubscriptions("cus_1")).toBe(0);
    expect(subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("throws when a cancel fails", async () => {
    subscriptionsList.mockResolvedValue(listed(subscription("active")));
    subscriptionsCancel.mockRejectedValue(new Error("stripe down"));
    subscriptionsRetrieve.mockResolvedValue(subscription("active"));

    await expect(cancelCustomerSubscriptions("cus_1")).rejects.toThrow("stripe down");
  });
});

describe("clearSubscription", () => {
  it("ends Pro and clears the stored subscription for that user", async () => {
    await clearSubscription("user-1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isPro: false, stripeSubscriptionId: null },
    });
  });
});
