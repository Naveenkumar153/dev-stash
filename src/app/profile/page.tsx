import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { ProfileStats } from "@/components/profile/ProfileStats";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserAvatar } from "@/components/user/UserAvatar";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getProfileStats, getProfileUser } from "@/lib/db/profile";
import { formatLongDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Profile | DevStash",
};

export default async function ProfilePage() {
  const user = await getProfileUser();

  // The proxy already redirects signed-out requests; this also catches a
  // still-valid session whose user row has been deleted.
  if (!user) {
    redirect(`${SIGN_IN_PATH}?callbackUrl=%2Fprofile`);
  }

  const stats = await getProfileStats(user.id);
  const displayName = user.name ?? user.email;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Link
        href="/dashboard"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="font-heading text-3xl font-semibold">Profile</h1>

      <Card>
        <CardContent className="flex items-center gap-4">
          <UserAvatar name={displayName} image={user.image} size="lg" className="size-16" />
          <div className="min-w-0">
            <p className="truncate font-heading text-lg font-semibold">{displayName}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Joined{" "}
              <time dateTime={user.createdAt.toISOString()}>{formatLongDate(user.createdAt)}</time>
            </p>
          </div>
        </CardContent>
      </Card>

      <ProfileStats stats={stats} />

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
