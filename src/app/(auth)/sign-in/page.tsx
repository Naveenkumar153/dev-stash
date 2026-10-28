import type { Metadata } from "next";
import Link from "next/link";

import { GitHubSignInButton } from "@/components/auth/GitHubSignInButton";
import { SignInForm } from "@/components/auth/SignInForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSignInErrorMessage, safeCallbackUrl } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Sign in | DevStash",
};

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl, error } = await searchParams;
  const redirectTo = safeCallbackUrl(callbackUrl);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sign in</CardTitle>
        <CardDescription>Welcome back to DevStash</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <GitHubSignInButton callbackUrl={redirectTo} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <SignInForm
          callbackUrl={redirectTo}
          initialError={typeof error === "string" ? getSignInErrorMessage(error) : null}
        />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        Don&apos;t have an account?
        <Link href="/register" className="ml-1 text-foreground underline-offset-4 hover:underline">
          Register
        </Link>
      </CardFooter>
    </Card>
  );
}
