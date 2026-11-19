"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CHECKOUT_REFRESH_ATTEMPTS, CHECKOUT_REFRESH_INTERVAL_MS } from "@/lib/plans";

/**
 * Mounted while "Finishing up your upgrade" shows: re-renders the page every
 * few seconds, which re-runs the post-checkout sync, until the subscription
 * lands and the notice (and this) unmounts. Gives up after a while, leaving
 * the notice's "refresh in a moment" to the user.
 */
export function CheckoutPendingRefresh() {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= CHECKOUT_REFRESH_ATTEMPTS) {
        window.clearInterval(timer);
      }
    }, CHECKOUT_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [router]);

  return null;
}
