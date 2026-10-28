import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/components/auth/RegisterForm";
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
  title: "Register | DevStash",
};

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Create an account</CardTitle>
        <CardDescription>Start stashing your developer knowledge</CardDescription>
      </CardHeader>

      <CardContent>
        <RegisterForm />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        Already have an account?
        <Link href={SIGN_IN_PATH} className="ml-1 text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
