"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { changePassword } from "@/actions/profile";
import { FormField } from "@/components/auth/FormField";
import { FormMessage } from "@/components/auth/FormMessage";
import { Button } from "@/components/ui/button";
import type { FieldErrors } from "@/lib/auth-schemas";

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Called directly rather than through `<form action>`, so a failed attempt
  // keeps what was typed and a successful one clears it.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await changePassword(formData);
      setError(result.error);
      setFieldErrors(result.fieldErrors);
      if (result.success) {
        form.reset();
        toast.success("Password changed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      {error && <FormMessage>{error}</FormMessage>}

      <FormField
        id="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        required
        error={fieldErrors.currentPassword}
      />
      <FormField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.password}
      />
      <FormField
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving..." : "Change password"}
      </Button>
    </form>
  );
}
