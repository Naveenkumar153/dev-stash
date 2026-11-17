import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

import { BillingProvider, BillingToggle, ProPrice } from "@/components/home/Billing";
import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { HomeSection } from "@/components/home/HomeSection";
import { PlanPrice } from "@/components/home/PlanPrice";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Card } from "@/components/ui/card";
import {
  FREE_PLAN_FEATURES,
  getStartAction,
  PRICING_ANCHOR,
  PRO_PLAN_FEATURES,
  type HomeLink,
  type PlanFeature,
} from "@/lib/homepage";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  name: string;
  price: ReactNode;
  description: string;
  features: readonly PlanFeature[];
  action: HomeLink;
  /** The recommended plan: outlined, glowing and badged "Most Popular". */
  highlighted?: boolean;
}

function PlanCard({ name, price, description, features, action, highlighted }: Readonly<PlanCardProps>) {
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
      <h3 className="text-lg font-bold">{name}</h3>
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
      <HomeButtonLink href={action.href} tone={highlighted ? "brand" : "outline"} className="w-full">
        {action.label}
      </HomeButtonLink>
    </Card>
  );
}

/** Free and Pro plans, with the monthly / yearly switch driving Pro's price. */
export function PricingSection({ isSignedIn }: Readonly<{ isSignedIn: boolean }>) {
  return (
    <HomeSection id={PRICING_ANCHOR}>
      <Reveal>
        <SectionHeader
          title="Simple, Transparent"
          highlight="Pricing"
          subtitle="Start free. Upgrade when you need more power."
          className="mb-8"
        />
      </Reveal>
      <BillingProvider>
        <Reveal className="mb-10">
          <BillingToggle />
        </Reveal>
        <div className="mx-auto grid max-w-190 grid-cols-1 gap-10 sm:grid-cols-2 sm:gap-6">
          <Reveal>
            <PlanCard
              name="Free"
              price={<PlanPrice amount="$0" />}
              description="Perfect for getting started"
              features={FREE_PLAN_FEATURES}
              action={getStartAction(isSignedIn, "Get Started")}
            />
          </Reveal>
          <Reveal className="sm:delay-100">
            <PlanCard
              name="Pro"
              price={<ProPrice />}
              description="For serious developers"
              features={PRO_PLAN_FEATURES}
              action={getStartAction(isSignedIn, "Upgrade to Pro")}
              highlighted
            />
          </Reveal>
        </div>
      </BillingProvider>
    </HomeSection>
  );
}
