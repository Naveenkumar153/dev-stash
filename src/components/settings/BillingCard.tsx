import { FormMessage } from "@/components/auth/FormMessage";
import { ButtonLink } from "@/components/common/ButtonLink";
import { CheckoutPendingRefresh } from "@/components/settings/CheckoutPendingRefresh";
import { ManageBillingButton } from "@/components/settings/ManageBillingButton";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingStatus } from "@/lib/db/billing";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT, UPGRADE_PATH } from "@/lib/plans";
import type { Usage } from "@/lib/usage-limits";

interface BillingCardProps {
  billing: BillingStatus;
  usage: Usage;
  /** Stripe redirected back here from a finished Checkout. */
  checkoutSucceeded: boolean;
}

function CheckoutNotice({ isPro }: Readonly<{ isPro: boolean }>) {
  return isPro ? (
    <FormMessage tone="success">Welcome to Pro! Everything is unlocked.</FormMessage>
  ) : (
    <>
      <FormMessage tone="info">Finishing up your upgrade… refresh in a moment.</FormMessage>
      <CheckoutPendingRefresh />
    </>
  );
}

/**
 * Plan & billing on /settings: the plan, usage against the Free limits, a link
 * to /upgrade for Free users and the Customer Portal for subscribers. Past
 * subscribers keep "Manage subscription" for their invoices.
 */
export function BillingCard({ billing, usage, checkoutSucceeded }: Readonly<BillingCardProps>) {
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
        {checkoutSucceeded && <CheckoutNotice isPro={billing.isPro} />}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Plan</dt>
          <dd>
            {billing.isPro ? (
              <Badge className="border-type-prompt/50 bg-type-prompt/15 font-semibold tracking-wide text-violet-200">
                Pro
              </Badge>
            ) : (
              <Badge variant="outline">Free</Badge>
            )}
          </dd>
          <dt className="text-muted-foreground">Usage</dt>
          <dd>
            {billing.isPro
              ? "Unlimited"
              : `${usage.items} / ${FREE_ITEM_LIMIT} items · ${usage.collections} / ${FREE_COLLECTION_LIMIT} collections`}
          </dd>
        </dl>

        {billing.isDemo ? (
          <p className="text-sm text-muted-foreground">
            Billing is closed on the shared demo account. Register your own account to upgrade.
          </p>
        ) : (
          <>
            {/* /upgrade is the one place to pick a plan and start Checkout. */}
            {!billing.isPro && (
              <ButtonLink href={UPGRADE_PATH} size="lg" className="w-fit">
                See plans and upgrade
              </ButtonLink>
            )}
            {(billing.isPro || billing.hasCustomer) && <ManageBillingButton />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
