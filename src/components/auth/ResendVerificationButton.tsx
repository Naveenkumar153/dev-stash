"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { resendVerificationEmail } from "@/actions/auth";
import { Button } from "@/components/ui/button";

interface ResendVerificationButtonProps {
  email: string;
}

export function ResendVerificationButton({ email }: ResendVerificationButtonProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await resendVerificationEmail(email);
      if (result.success) {
        toast.success("Verification email sent", { description: `Check ${email} for the link.` });
      } else {
        toast.error(result.error ?? "Could not send the email. Please try again.");
      }
    });
  }

  return (
    <Button type="button" variant="outline" disabled={pending} onClick={handleClick} className="w-full">
      {pending ? "Sending..." : "Resend verification email"}
    </Button>
  );
}
