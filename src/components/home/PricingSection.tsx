import { PlanCard } from "@/components/billing/PlanCard";
import { BillingProvider, BillingToggle, ProPrice, ProUpgradeLink } from "@/components/home/Billing";
import { HomeButtonLink } from "@/components/home/HomeButtonLink";
import { HomeSection } from "@/components/home/HomeSection";
import { PlanPrice } from "@/components/home/PlanPrice";
import { Reveal } from "@/components/home/Reveal";
import { SectionHeader } from "@/components/home/SectionHeader";
import {
  FREE_PLAN_FEATURES,
  getStartAction,
  PRICING_ANCHOR,
  PRO_PLAN_FEATURES,
  type HomeLink,
} from "@/lib/homepage";

function FreeAction({ action }: Readonly<{ action: HomeLink }>) {
  return (
    <HomeButtonLink href={action.href} tone="outline" className="w-full">
      {action.label}
    </HomeButtonLink>
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
              action={<FreeAction action={getStartAction(isSignedIn, "Get Started")} />}
            />
          </Reveal>
          <Reveal className="sm:delay-100">
            <PlanCard
              name="Pro"
              price={<ProPrice />}
              description="For serious developers"
              features={PRO_PLAN_FEATURES}
              action={<ProUpgradeLink isSignedIn={isSignedIn} />}
              highlighted
            />
          </Reveal>
        </div>
      </BillingProvider>
    </HomeSection>
  );
}
