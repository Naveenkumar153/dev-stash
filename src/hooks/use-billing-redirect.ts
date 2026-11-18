"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { BillingRedirectResult } from "@/types/billing";

const REDIRECT_FAILED = "Couldn't reach billing. Please try again.";

/**
 * Runs a billing action (Checkout or the Customer Portal) and opens the
 * Stripe-hosted page it returns. `pendingKey` names the button that started it
 * and stays set until the browser leaves, so its "Redirecting..." label and the
 * disabled buttons don't flash back while Stripe loads. A failed or thrown call
 * toasts and clears it, and so does coming Back from Stripe to a page the
 * browser restored from its back/forward cache with that state still set.
 */
export function useBillingRedirect<Key extends string>() {
  const [pendingKey, setPendingKey] = useState<Key | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        setPendingKey(null);
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  function redirect(key: Key, action: () => Promise<BillingRedirectResult>) {
    setPendingKey(key);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.success && result.data) {
          window.location.assign(result.data.url);
          return;
        }
        toast.error(result.error ?? REDIRECT_FAILED);
      } catch {
        toast.error(REDIRECT_FAILED);
      }
      setPendingKey(null);
    });
  }

  return { pendingKey, redirect };
}
