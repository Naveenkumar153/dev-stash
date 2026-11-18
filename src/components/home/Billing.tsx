"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { PlanPrice } from "@/components/home/PlanPrice";
import { Switch } from "@/components/ui/switch";
import { getProPrice, getUpgradeAction, type BillingPeriod } from "@/lib/homepage";
import { getYearlySavingsPercent } from "@/lib/plans";

interface BillingContextValue {
  period: BillingPeriod;
  setPeriod: (period: BillingPeriod) => void;
}

const BillingContext = createContext<BillingContextValue | null>(null);

function useBilling(): BillingContextValue {
  const value = useContext(BillingContext);
  if (!value) throw new Error("useBilling must be used inside BillingProvider");
  return value;
}

/**
 * Holds the pricing section's monthly / yearly choice, so the toggle and the Pro
 * price can be separate client islands while the plan cards stay server-rendered.
 */
export function BillingProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  return <BillingContext value={{ period, setPeriod }}>{children}</BillingContext>;
}

const PERIOD_LABEL_CLASS =
  "cursor-pointer text-sm font-semibold text-muted-foreground transition-colors data-[active=true]:text-foreground";

/** "Monthly [switch] Yearly  Save 25%". The words also pick their period. */
export function BillingToggle() {
  const { period, setPeriod } = useBilling();
  const isYearly = period === "yearly";

  return (
    <div className="flex items-center justify-center gap-3">
      <span
        aria-hidden
        data-active={!isYearly}
        className={PERIOD_LABEL_CLASS}
        onClick={() => setPeriod("monthly")}
      >
        Monthly
      </span>
      <Switch
        aria-label="Bill yearly"
        checked={isYearly}
        onCheckedChange={(checked) => setPeriod(checked ? "yearly" : "monthly")}
        className="data-checked:bg-indigo-500 dark:data-checked:bg-indigo-500"
      />
      <span
        aria-hidden
        data-active={isYearly}
        className={PERIOD_LABEL_CLASS}
        onClick={() => setPeriod("yearly")}
      >
        Yearly
      </span>
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
        Save {getYearlySavingsPercent()}%
      </span>
    </div>
  );
}

/** Pro's price for the chosen period; the amount slides in on each change. */
export function ProPrice() {
  const { period } = useBilling();
  const { amount, billed } = getProPrice(period);

  return <PlanPrice amount={amount} billed={billed} animationKey={period} />;
}

/** The Pro card's button, carrying the period picked on the switch to /settings. */
export function ProUpgradeLink({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  const { period } = useBilling();
  const action = getUpgradeAction(isSignedIn, period);

  return (
    <HomeButtonLink href={action.href} tone="brand" className="w-full">
      {action.label}
    </HomeButtonLink>
  );
}
