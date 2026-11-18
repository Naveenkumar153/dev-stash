import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/webhooks/stripe/route";
import { syncSubscription } from "@/lib/db/billing";

// Payloads are signed and verified with the real SDK (pure crypto, no
// network); only the sync that writes to the database is mocked.
vi.mock("@/lib/db/billing", () => ({ syncSubscription: vi.fn() }));

const SECRET = "whsec_test_secret";
const signer = new Stripe("sk_test_signer");

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
});

function event(type: string, object: Record<string, unknown>) {
  return { id: "evt_1", object: "event", type, data: { object } };
}

function signedRequest(body: unknown, secret = SECRET) {
  const payload = JSON.stringify(body);
  const signature = signer.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: payload,
  });
}

async function send(request: Request) {
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
}

describe("POST /api/webhooks/stripe", () => {
  it("refuses a request without a signature", async () => {
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify(event("customer.subscription.updated", { id: "sub_1" })),
    });

    const { status, body } = await send(request);

    expect(status).toBe(400);
    expect(body).toMatchObject({ success: false, error: "Missing Stripe signature." });
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("refuses a payload signed with another secret", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = await send(
      signedRequest(event("customer.subscription.updated", { id: "sub_1" }), "whsec_other"),
    );

    expect(status).toBe(400);
    expect(body.error).toBe("Invalid Stripe signature.");
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("refuses a junk signature header", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=junk" },
      body: JSON.stringify(event("customer.subscription.updated", { id: "sub_1" })),
    });

    expect((await send(request)).status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("refuses a body changed after signing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const signed = signedRequest(event("customer.subscription.updated", { id: "sub_1" }));
    const tampered = new Request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: JSON.stringify(event("customer.subscription.updated", { id: "sub_2" })),
    });

    expect((await send(tampered)).status).toBe(400);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("syncs a subscription checkout's subscription", async () => {
    const { status, body } = await send(
      signedRequest(
        event("checkout.session.completed", { id: "cs_test_1", mode: "subscription", subscription: "sub_1" }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(syncSubscription).toHaveBeenCalledExactlyOnceWith("sub_1");
  });

  it("ignores a one-time payment checkout", async () => {
    const { status } = await send(
      signedRequest(event("checkout.session.completed", { id: "cs_test_1", mode: "payment", subscription: null })),
    );

    expect(status).toBe(200);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.paused",
    "customer.subscription.resumed",
  ])("syncs the subscription on %s", async (type) => {
    const { status } = await send(signedRequest(event(type, { id: "sub_9", object: "subscription" })));

    expect(status).toBe(200);
    expect(syncSubscription).toHaveBeenCalledExactlyOnceWith("sub_9");
  });

  it("acknowledges a failed payment without a write", async () => {
    const { status } = await send(signedRequest(event("invoice.payment_failed", { id: "in_1" })));

    expect(status).toBe(200);
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("acknowledges event types it doesn't handle", async () => {
    const { status, body } = await send(signedRequest(event("customer.created", { id: "cus_1" })));

    expect(status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("answers a failed sync with a 500 so Stripe retries", async () => {
    vi.mocked(syncSubscription).mockRejectedValue(new Error("db down"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const { status, body } = await send(
      signedRequest(event("customer.subscription.updated", { id: "sub_1" })),
    );

    expect(status).toBe(500);
    expect(body.error).toBe("Webhook handler failed.");
    expect(log.mock.calls[0][0]).toBe(
      "Handling Stripe event customer.subscription.updated (evt_1) failed",
    );
  });
});
