import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { FormMessage } from "@/components/auth/FormMessage";
import { PlanCard } from "@/components/billing/PlanCard";
import { UpgradePlanPicker } from "@/components/billing/UpgradePlanPicker";
import { PlanPrice } from "@/components/home/PlanPrice";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getSessionUser } from "@/lib/db/user";
import { BILLING_SETTINGS_PATH, FREE_PLAN_FEATURES, parseBillingInterval } from "@/lib/plans";

export const metadata: Metadata = { title: "Upgrade | DevStash" };

/**
 * Where a Free user upgrades: the Free and Pro plans side by side, as on the
 * homepage's pricing section, with monthly or yearly picked on the Pro card
 * before Stripe Checkout. Pro users manage their plan on /settings instead.
 */
export default async function UpgradePage({ searchParams }: PageProps<"/upgrade">) {
  const [user, query] = await Promise.all([getSessionUser(), searchParams]);

  // The proxy and the layout already redirect signed-out requests.
  if (!user) {
    redirect(SIGN_IN_PATH);
  }
  if (user.isPro) {
    redirect(BILLING_SETTINGS_PATH);
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-type-prompt/15">
          <Sparkles aria-hidden className="size-6 text-violet-300" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold">Upgrade to Pro</h1>
          <p className="mt-1 text-muted-foreground">
            Unlimited items and collections, file and image uploads, and AI features.
          </p>
        </div>
      </header>

      {query.checkout === "canceled" && (
        <FormMessage tone="info">Checkout canceled. You&apos;re still on the Free plan.</FormMessage>
      )}

      {/* Sized by the content column, which the open sidebar narrows. */}
      <div className="@container">
        {/* Pro first, so phones read the plan to buy before the current one. */}
        <div className="grid grid-cols-1 gap-10 pt-3 @2xl:grid-cols-2 @2xl:gap-6">
          <UpgradePlanPicker initialInterval={parseBillingInterval(query.plan)} />
          <div className="@2xl:order-first">
            <PlanCard
              name="Free"
              headingAs="h2"
              price={<PlanPrice amount="$0" />}
              description="Your current plan"
              features={FREE_PLAN_FEATURES}
              action={
                <p className="rounded-lg border border-dashed border-border py-2.5 text-center text-sm text-muted-foreground">
                  You&apos;re on Free
                </p>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
