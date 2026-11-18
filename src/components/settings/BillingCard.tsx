import { FormMessage } from "@/components/auth/FormMessage";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import { UpgradeButtons } from "@/components/settings/UpgradeButtons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingStatus } from "@/lib/db/billing";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT, type BillingInterval } from "@/lib/plans";
import type { Usage } from "@/lib/usage-limits";

/** The `?checkout=` value Stripe redirects back with. */
export type CheckoutOutcome = "success" | "canceled";

interface BillingCardProps {
  billing: BillingStatus;
  usage: Usage;
  checkout: CheckoutOutcome | null;
  preferredInterval: BillingInterval;
}

interface CheckoutNoticeProps {
  checkout: CheckoutOutcome;
  isPro: boolean;
}

function CheckoutNotice({ checkout, isPro }: Readonly<CheckoutNoticeProps>) {
  if (checkout === "canceled") {
    return (
      <FormMessage tone="info">Checkout canceled. You&apos;re still on the Free plan.</FormMessage>
    );
  }
  return isPro ? (
    <FormMessage tone="success">Welcome to Pro! Everything is unlocked.</FormMessage>
  ) : (
    <FormMessage tone="info">Finishing up your upgrade… refresh in a moment.</FormMessage>
  );
}

/**
 * Plan & billing on /settings: the plan, usage against the Free limits and the
 * Stripe buttons. Past subscribers keep "Manage subscription" for their invoices.
 */
export function BillingCard({
  billing,
  usage,
  checkout,
  preferredInterval,
}: Readonly<BillingCardProps>) {
  return (
    <Card id="billing" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>Plan &amp; billing</CardTitle>
        <CardDescription>
          {billing.isPro
            ? "DevStash Pro: unlimited items and collections, plus file and image uploads."
            : "Upgrade to Pro for unlimited items and collections, plus file and image uploads."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {checkout && <CheckoutNotice checkout={checkout} isPro={billing.isPro} />}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Plan</dt>
          <dd className="font-medium">{billing.isPro ? "Pro" : "Free"}</dd>
          <dt className="text-muted-foreground">Usage</dt>
          <dd>
            {billing.isPro
              ? "Unlimited"
              : `${usage.items} / ${FREE_ITEM_LIMIT} items · ${usage.collections} / ${FREE_COLLECTION_LIMIT} collections`}
          </dd>
        </dl>

        {!billing.isPro && <UpgradeButtons preferred={preferredInterval} />}
        {(billing.isPro || billing.hasCustomer) && <ManageBillingButton />}
      </CardContent>
    </Card>
  );
}
