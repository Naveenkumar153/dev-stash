import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
import { getEditorPreferences } from "@/lib/db/editor-preferences";
import { getProfileUser } from "@/lib/db/profile";

export const metadata: Metadata = {
  title: "Settings | DevStash",
};

const SIGN_IN_TO_SETTINGS = `${SIGN_IN_PATH}?callbackUrl=%2Fsettings`;

export default async function SettingsPage() {
  const [user, editorPreferences] = await Promise.all([getProfileUser(), getEditorPreferences()]);

  // The proxy already redirects signed-out requests; this also catches a
  // still-valid session whose user row has been deleted.
  if (!user) {
    redirect(SIGN_IN_TO_SETTINGS);
  }

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
          <DeleteAccountDialog />
        </CardContent>
      </Card>
    </main>
  );
}
