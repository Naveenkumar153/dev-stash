"use client";

import { createPortalSession } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { useBillingRedirect } from "@/hooks/use-billing-redirect";

/**
 * Opens the Stripe Customer Portal: switch between monthly and yearly, cancel,
 * update the card, download invoices.
 */
export function ManageBillingButton() {
  const { pendingKey, redirect } = useBillingRedirect<"portal">();

  return (
    <Button
      size="lg"
      variant="outline"
      className="w-fit"
      disabled={pendingKey !== null}
      onClick={() => redirect("portal", createPortalSession)}
    >
      {pendingKey ? "Redirecting..." : "Manage subscription"}
    </Button>
  );
}
