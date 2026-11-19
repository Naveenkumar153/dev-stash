import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import type { PlanFeature } from "@/lib/homepage";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  name: string;
  price: ReactNode;
  description: string;
  features: readonly PlanFeature[];
  /** The card's button, at full width. */
  action: ReactNode;
  /** The recommended plan: outlined, glowing and badged "Most Popular". */
  highlighted?: boolean;
  /** The plan name's heading level: h3 under the homepage's section h2, h2 under a page h1. */
  headingAs?: "h2" | "h3";
}

/**
 * A pricing plan: name, price, feature checklist and a button. Presentational,
 * shared by the homepage's pricing section and the /upgrade page.
 */
export function PlanCard({
  name,
  price,
  description,
  features,
  action,
  highlighted,
  headingAs: Heading = "h3",
}: Readonly<PlanCardProps>) {
  return (
    <Card
      className={cn(
        "relative h-full gap-0 overflow-visible rounded-[14px] px-5.5 py-7 text-base sm:px-8 sm:py-8",
        highlighted &&
          "bg-[radial-gradient(circle_at_50%_0%,rgb(99_102_241/0.14),transparent_65%)] shadow-[0_30px_80px_-40px_rgb(99_102_241/0.6)] ring-indigo-500/60",
      )}
    >
      {highlighted && (
        <span className="absolute top-0 left-1/2 -translate-1/2 rounded-full bg-brand-gradient px-3 py-1 text-[11px] font-bold whitespace-nowrap text-white">
          Most Popular
        </span>
      )}
      <Heading className="text-lg font-bold">{name}</Heading>
      <div className="mt-4">{price}</div>
      <p className="mt-2.5 text-sm text-muted-foreground">{description}</p>
      <ul className="mt-6.5 mb-7.5 grid flex-1 content-start gap-3 text-sm text-foreground/85">
        {features.map(({ label, included }) => (
          <li key={label} className={cn("flex gap-2.5", !included && "text-muted-foreground")}>
            {included ? (
              <Check aria-label="Included" className="mt-0.75 size-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
            ) : (
              <X aria-label="Not included" className="mt-0.75 size-4 shrink-0" />
            )}
            {label}
          </li>
        ))}
      </ul>
      {action}
    </Card>
  );
}
