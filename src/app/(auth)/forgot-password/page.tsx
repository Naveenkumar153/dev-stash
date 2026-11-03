import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";

export const metadata: Metadata = {
  title: "Forgot password | DevStash",
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Forgot password</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
      </CardHeader>

      <CardContent>
        <ForgotPasswordForm />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        Remembered it?
        <Link href={SIGN_IN_PATH} className="ml-1 text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
