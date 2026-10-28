"use client";

import { startTransition, useActionState } from "react";

import { signInWithCredentials, type SignInState } from "@/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { Button } from "@/components/ui/button";

interface SignInFormProps {
  callbackUrl: string;
  /** Message for an `?error=` NextAuth put on the URL before this page loaded. */
  initialError: string | null;
}

export function SignInForm({ callbackUrl, initialError }: SignInFormProps) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    signInWithCredentials,
    { success: false, error: initialError, fieldErrors: {} },
  );

  // Dispatched from `onSubmit` rather than `<form action>`, which resets the
  // fields after every attempt - a failed sign-in would wipe what was typed.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors.email}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors.password}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
