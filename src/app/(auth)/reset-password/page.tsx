import type { Metadata } from "next";
import Link from "next/link";

import { ResetLinkFailed, ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PASSWORD_RESET_ERRORS, SIGN_IN_PATH } from "@/lib/auth-redirect";
import { checkPasswordResetToken } from "@/lib/password-reset";

export const metadata: Metadata = {
  title: "Reset password | DevStash",
  // The token is in this page's URL; keep it out of Referer headers.
  referrer: "no-referrer",
};

interface ResetPasswordPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// The link in the reset email. The token is checked up front so a dead link
// says so before the user types a new password; submitting checks it again.
export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email.trim().toLowerCase() : "";
  const token = typeof params.token === "string" ? params.token : "";
  const status = email && token ? await checkPasswordResetToken(email, token) : "invalid";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Reset password</CardTitle>
        <CardDescription>
          {status === "valid" ? `Choose a new password for ${email}` : "This link can't be used"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {status === "valid" ? (
          <ResetPasswordForm email={email} token={token} />
        ) : (
          <ResetLinkFailed message={PASSWORD_RESET_ERRORS[status]} />
        )}
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href={SIGN_IN_PATH} className="text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
