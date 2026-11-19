import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BillingCard, type CheckoutOutcome } from "@/components/settings/BillingCard";
import { EditorPreferencesForm } from "@/components/settings/EditorPreferencesForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getBillingStatus, syncCheckoutForUser } from "@/lib/db/billing";
import { getEditorPreferences } from "@/lib/db/editor-preferences";
import { getProfileUser } from "@/lib/db/profile";
import { parseBillingInterval } from "@/lib/plans";
import { getUsage } from "@/lib/usage-limits";

export const metadata: Metadata = {
  title: "Settings | DevStash",
};

const SIGN_IN_TO_SETTINGS = `${SIGN_IN_PATH}?callbackUrl=%2Fsettings`;

/** A query parameter's value, ignoring a repeated one. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toCheckoutOutcome(value: string | undefined): CheckoutOutcome | null {
  return value === "success" || value === "canceled" ? value : null;
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const [user, editorPreferences, query] = await Promise.all([
    getProfileUser(),
    getEditorPreferences(),
    searchParams,
  ]);

  // The proxy already redirects signed-out requests; this also catches a
  // still-valid session whose user row has been deleted.
  if (!user) {
    redirect(SIGN_IN_TO_SETTINGS);
  }

  // Stripe's return from Checkout: apply the subscription now rather than
  // waiting for the webhook, so the card below already reads Pro.
  const checkout = toCheckoutOutcome(firstParam(query.checkout));
  const sessionId = firstParam(query.session_id);
  if (checkout === "success" && sessionId) {
    await syncCheckoutForUser(user.id, sessionId);
  }

  const [billing, usage] = await Promise.all([getBillingStatus(user.id), getUsage(user.id)]);
  // `?plan=yearly` makes the yearly button the primary one.
  const preferredInterval = parseBillingInterval(firstParam(query.plan));
  const isPro = billing?.isPro ?? false;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="font-heading text-3xl font-semibold">Settings</h1>

      <BillingCard
        billing={billing ?? { isPro: false, hasCustomer: false }}
        usage={usage}
        checkout={checkout}
        preferredInterval={preferredInterval}
      />

      <Card>
        <CardHeader>
          <CardTitle>Editor preferences</CardTitle>
          <CardDescription>
            How code looks in the item drawer and when you create or edit an item. Changes save
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EditorPreferencesForm initialPreferences={editorPreferences} />
        </CardContent>
      </Card>

      {user.hasPassword && (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>You&apos;ll use the new password next time you sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      )}

      <Card className="ring-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently remove your account and everything in it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountDialog isPro={isPro} />
        </CardContent>
      </Card>
    </main>
  );
}
