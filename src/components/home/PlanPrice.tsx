import { cn } from "@/lib/utils";

interface PlanPriceProps {
  amount: string;
  /** Billing note under the price, e.g. "billed monthly". */
  billed?: string;
  /** Changing it replays the amount's slide-in, e.g. on a billing switch. */
  animationKey?: string;
}

/** A plan's "$8/month" line. Presentational, so server and client cards share it. */
export function PlanPrice({ amount, billed, animationKey }: Readonly<PlanPriceProps>) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1">
      <span
        key={animationKey}
        className={cn(
          "text-[44px] leading-none font-extrabold tracking-tight",
          animationKey && "motion-safe:animate-price-swap",
        )}
      >
        {amount}
      </span>
      <span className="text-sm text-muted-foreground">/month</span>
      {billed && (
        <span aria-live="polite" className="mt-1.5 basis-full text-[13px] text-muted-foreground">
          {billed}
        </span>
      )}
    </p>
  );
}
