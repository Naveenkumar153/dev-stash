"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
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
  const router = useRouter();
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

      // The Toaster lives in the root layout, so the toast outlives this page.
      toast.success("Account created", {
        description: "You can now sign in with your email and password.",
      });
      // Left pending so the button stays disabled until the page changes.
      router.push(SIGN_IN_PATH);
    } catch {
      setError(SERVER_UNREACHABLE);
      setPending(false);
    }
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
