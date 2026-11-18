import type { Session } from "next-auth";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckoutSession, createPortalSession } from "@/actions/billing";
import { auth } from "@/auth";
import { getBillingStatus, getOrCreateCustomerId } from "@/lib/db/billing";
import { getPriceId, getStripe } from "@/lib/stripe";

// The session, the billing data layer and Stripe are mocked; the interval
// schema runs for real.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/billing", () => ({
  getBillingStatus: vi.fn(),
  getOrCreateCustomerId: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn(), getPriceId: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const checkoutCreate = vi.fn();
const portalCreate = vi.fn();

const SETTINGS = "http://localhost:3000/settings";

beforeEach(() => {
  mockAuth.mockResolvedValue({
    user: { id: "user-1", isPro: false },
    expires: "2099-01-01T00:00:00.000Z",
  });
  vi.mocked(getStripe).mockReturnValue({
    checkout: { sessions: { create: checkoutCreate } },
    billingPortal: { sessions: { create: portalCreate } },
  } as unknown as Stripe);
  vi.mocked(getBillingStatus).mockResolvedValue({ isPro: false, hasCustomer: false });
  vi.mocked(getOrCreateCustomerId).mockResolvedValue("cus_1");
  vi.mocked(getPriceId).mockImplementation((interval) => `price_${interval}`);
  checkoutCreate.mockResolvedValue({ id: "cs_test_1", url: "https://checkout.stripe.com/c/1" });
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.com/p/1" });
});

describe("createCheckoutSession", () => {
  it.each(["monthly", "yearly"] as const)(
    "starts a %s subscription checkout for the user's customer",
    async (interval) => {
      expect(await createCheckoutSession(interval)).toEqual({
        success: true,
        data: { url: "https://checkout.stripe.com/c/1" },
        error: null,
      });
      expect(getOrCreateCustomerId).toHaveBeenCalledWith("user-1");
      expect(checkoutCreate).toHaveBeenCalledWith({
        mode: "subscription",
        customer: "cus_1",
        client_reference_id: "user-1",
        line_items: [{ price: `price_${interval}`, quantity: 1 }],
        subscription_data: { metadata: { userId: "user-1" } },
        allow_promotion_codes: true,
        success_url: `${SETTINGS}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SETTINGS}?checkout=canceled`,
      });
    },
  );

  it("builds the return URLs from AUTH_URL", async () => {
    vi.stubEnv("AUTH_URL", "https://devstash.io/");

    await createCheckoutSession("monthly");

    expect(checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ cancel_url: "https://devstash.io/settings?checkout=canceled" }),
    );
  });

  it("refuses a signed-out request without calling Stripe", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await createCheckoutSession("monthly")).toEqual({
      success: false,
      data: null,
      error: "Your session has expired. Sign in again.",
    });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it.each(["weekly", "", null, 8])("refuses the interval %j without calling Stripe", async (interval) => {
    expect(await createCheckoutSession(interval)).toEqual({
      success: false,
      data: null,
      error: "Choose monthly or yearly billing.",
    });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("sends a Pro user to the Portal instead of a second subscription", async () => {
    vi.mocked(getBillingStatus).mockResolvedValue({ isPro: true, hasCustomer: true });

    expect(await createCheckoutSession("yearly")).toEqual({
      success: true,
      data: { url: "https://billing.stripe.com/p/1" },
      error: null,
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
    expect(portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: SETTINGS });
  });

  it("returns a generic error when Stripe fails", async () => {
    checkoutCreate.mockRejectedValue(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createCheckoutSession("monthly")).toEqual({
      success: false,
      data: null,
      error: "Couldn't start checkout. Please try again.",
    });
  });

  it("returns a generic error when the session comes back without a URL", async () => {
    checkoutCreate.mockResolvedValue({ id: "cs_test_1", url: null });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createCheckoutSession("monthly")).toMatchObject({
      success: false,
      error: "Couldn't start checkout. Please try again.",
    });
  });

  it("returns a generic error when the customer can't be created", async () => {
    vi.mocked(getOrCreateCustomerId).mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createCheckoutSession("monthly")).toMatchObject({
      success: false,
      error: "Couldn't start checkout. Please try again.",
    });
    expect(checkoutCreate).not.toHaveBeenCalled();
  });
});

describe("createPortalSession", () => {
  it("opens the Portal for the user's customer, returning to settings", async () => {
    expect(await createPortalSession()).toEqual({
      success: true,
      data: { url: "https://billing.stripe.com/p/1" },
      error: null,
    });
    expect(portalCreate).toHaveBeenCalledWith({ customer: "cus_1", return_url: SETTINGS });
  });

  it("refuses a signed-out request without calling Stripe", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await createPortalSession()).toMatchObject({
      success: false,
      error: "Your session has expired. Sign in again.",
    });
    expect(getStripe).not.toHaveBeenCalled();
  });

  it("returns a generic error when Stripe fails", async () => {
    portalCreate.mockRejectedValue(new Error("stripe down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await createPortalSession()).toEqual({
      success: false,
      data: null,
      error: "Couldn't open billing. Please try again.",
    });
  });
});
