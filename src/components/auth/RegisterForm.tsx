"use client";

import { useState } from "react";
import Link from "next/link";

import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";
import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getFieldErrors, registerSchema, type FieldErrors } from "@/lib/auth-schemas";
import type { RegisterResponse } from "@/types/auth";

const SERVER_UNREACHABLE = "Could not reach the server. Please try again.";

/**
 * Validates with the same schema the route uses, so most mistakes are caught
 * without a round trip, then posts to `/api/auth/register`.
 */
export function RegisterForm() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));

    const parsed = registerSchema.safeParse(values);
    setError(null);
    if (!parsed.success) {
      setFieldErrors(getFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = (await response.json()) as RegisterResponse;

      if (!response.ok) {
        setError(body.error ?? SERVER_UNREACHABLE);
        setPending(false);
        return;
      }

      setRegisteredEmail(body.data?.email ?? parsed.data.email);
    } catch {
      setError(SERVER_UNREACHABLE);
      setPending(false);
    }
  }

  if (registeredEmail) {
    return (
      <div className="grid gap-4 text-sm">
        <FormMessage tone="success">Account created. Check your email.</FormMessage>
        <p className="text-muted-foreground">
          We sent a verification link to{" "}
          <span className="font-medium text-foreground">{registeredEmail}</span>. Click it to
          activate your account, then sign in. The link expires in 24 hours.
        </p>
        <ResendVerificationButton email={registeredEmail} />
        <Button render={<Link href={SIGN_IN_PATH} />} nativeButton={false} className="w-full">
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {error && <FormMessage>{error}</FormMessage>}

      <FormField
        id="name"
        label="Name"
        autoComplete="name"
        required
        error={fieldErrors.name}
      />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={fieldErrors.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.password}
      />
      <FormField
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
