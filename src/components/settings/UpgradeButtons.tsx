"use client";

import { createCheckoutSession } from "@/actions/billing";
import { Button } from "@/components/ui/button";
import { useBillingRedirect } from "@/hooks/use-billing-redirect";
import {
  BILLING_INTERVALS,
  PRO_PRICES,
  getYearlySavingsPercent,
  type BillingInterval,
} from "@/lib/plans";

interface UpgradeButtonsProps {
  /** The plan picked on the homepage (`?plan=`), shown as the primary button. */
  preferred: BillingInterval;
}

const LABELS: Record<BillingInterval, string> = {
  monthly: `Upgrade: $${PRO_PRICES.monthly}/mo`,
  yearly: `Upgrade: $${PRO_PRICES.yearly}/yr (save ${getYearlySavingsPercent()}%)`,
};

/** Starts Stripe Checkout for Pro, monthly or yearly. */
export function UpgradeButtons({ preferred }: Readonly<UpgradeButtonsProps>) {
  const { pendingKey, redirect } = useBillingRedirect<BillingInterval>();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      {BILLING_INTERVALS.map((interval) => (
        <Button
          key={interval}
          size="lg"
          variant={interval === preferred ? "default" : "outline"}
          disabled={pendingKey !== null}
          onClick={() => redirect(interval, () => createCheckoutSession(interval))}
        >
          {pendingKey === interval ? "Redirecting..." : LABELS[interval]}
        </Button>
      ))}
    </div>
  );
}
