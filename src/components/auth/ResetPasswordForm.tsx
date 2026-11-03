"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";

import { resetPassword, type ResetPasswordState } from "@/actions/auth";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { Button } from "@/components/ui/button";
import { FORGOT_PASSWORD_PATH } from "@/lib/auth-redirect";

interface ResetPasswordFormProps {
  email: string;
  token: string;
}

export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    { error: null, fieldErrors: {} },
  );

  // Dispatched from `onSubmit` so a failed attempt keeps what was typed.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  if (state.linkFailed) {
    return <ResetLinkFailed message={state.error ?? ""} />;
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {state.error && <FormMessage>{state.error}</FormMessage>}

      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="token" value={token} />
      <FormField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors.password}
      />
      <FormField
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors.confirmPassword}
      />

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving..." : "Reset password"}
      </Button>
    </form>
  );
}

interface ResetLinkFailedProps {
  message: string;
}

/** An unusable reset link, with a way to request a fresh one. */
export function ResetLinkFailed({ message }: ResetLinkFailedProps) {
  return (
    <div className="grid gap-4">
      <FormMessage>{message}</FormMessage>
      <Button render={<Link href={FORGOT_PASSWORD_PATH} />} nativeButton={false} className="w-full">
        Request a new link
      </Button>
    </div>
  );
}
