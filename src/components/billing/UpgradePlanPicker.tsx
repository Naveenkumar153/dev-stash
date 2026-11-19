"use client";

import { useState } from "react";

import { createCheckoutSession } from "@/actions/billing";
import { PlanCard } from "@/components/billing/PlanCard";
import { PlanPrice } from "@/components/home/PlanPrice";
import { Button } from "@/components/ui/button";
import { useBillingRedirect } from "@/hooks/use-billing-redirect";
import {
  BILLING_INTERVALS,
  PRO_PLAN_FEATURES,
  PRO_PRICES,
  getProPrice,
  getYearlySavingsPercent,
  type BillingInterval,
} from "@/lib/plans";
import { cn } from "@/lib/utils";

const INTERVAL_OPTIONS: Record<
  BillingInterval,
  { label: string; price: string; note: string; buttonPrice: string }
> = {
  monthly: {
    label: "Monthly",
    price: `$${PRO_PRICES.monthly}/mo`,
    note: "Billed every month",
    buttonPrice: `$${PRO_PRICES.monthly}/month`,
  },
  yearly: {
    label: "Yearly",
    price: `$${PRO_PRICES.yearly}/yr`,
    note: `Save ${getYearlySavingsPercent()}% over monthly`,
    buttonPrice: `$${PRO_PRICES.yearly}/year`,
  },
};

interface IntervalPickerProps {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  disabled: boolean;
}

/** Monthly or yearly as two radio options, both prices visible at once. */
function IntervalPicker({ value, onChange, disabled }: Readonly<IntervalPickerProps>) {
  return (
    <fieldset disabled={disabled} className="mb-4 grid gap-2">
      <legend className="mb-2 text-sm font-medium">Billing</legend>
      {BILLING_INTERVALS.map((interval) => {
        const option = INTERVAL_OPTIONS[interval];
        return (
          <label
            key={interval}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3.5 py-3 transition-colors hover:bg-muted/40",
              "has-checked:border-indigo-500/70 has-checked:bg-indigo-500/10",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              "has-disabled:cursor-not-allowed has-disabled:opacity-70",
            )}
          >
            <input
              type="radio"
              name="billing-interval"
              value={interval}
              checked={value === interval}
              onChange={() => onChange(interval)}
              className="size-4 shrink-0 accent-indigo-500 focus-visible:outline-none"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span
                className={cn(
                  "block text-xs text-muted-foreground",
                  interval === "yearly" && "text-emerald-400",
                )}
              >
                {option.note}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{option.price}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

interface UpgradePlanPickerProps {
  /** The interval picked before arriving, e.g. `?plan=yearly` from the homepage. */
  initialInterval: BillingInterval;
}

/**
 * The /upgrade page's Pro card: its price follows the interval picked below
 * it, and the button starts Stripe Checkout for that interval.
 */
export function UpgradePlanPicker({ initialInterval }: Readonly<UpgradePlanPickerProps>) {
  const [interval, setSelectedInterval] = useState<BillingInterval>(initialInterval);
  const { pendingKey, redirect } = useBillingRedirect<BillingInterval>();
  const pending = pendingKey !== null;
  const { amount, billed } = getProPrice(interval);

  return (
    <PlanCard
      name="Pro"
      headingAs="h2"
      price={<PlanPrice amount={amount} billed={billed} animationKey={interval} />}
      description="For serious developers"
      features={PRO_PLAN_FEATURES}
      highlighted
      action={
        <div>
          <IntervalPicker value={interval} onChange={setSelectedInterval} disabled={pending} />
          <Button
            size="lg"
            className="h-11.5 w-full bg-brand-gradient text-[15px] font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/30"
            disabled={pending}
            onClick={() => redirect(interval, () => createCheckoutSession(interval))}
          >
            {pending
              ? "Redirecting..."
              : `Upgrade to Pro: ${INTERVAL_OPTIONS[interval].buttonPrice}`}
          </Button>
        </div>
      }
    />
  );
}
