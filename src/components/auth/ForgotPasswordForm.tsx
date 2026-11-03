"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";

import { requestPasswordReset, type ForgotPasswordState } from "@/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    { success: false, error: null, fieldErrors: {} },
  );

  // Dispatched from `onSubmit` so a failed attempt keeps the typed email.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.success) {
    return (
      <div className="grid gap-4 text-sm">
        <FormMessage tone="success">Check your email.</FormMessage>
        <p className="text-muted-foreground">
          If an account exists for{" "}
          <span className="font-medium text-foreground">{state.email}</span>, we sent a link to
          reset its password. The link expires in 1 hour.
        </p>
        <Button render={<Link href={SIGN_IN_PATH} />} nativeButton={false} className="w-full">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors.email}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
