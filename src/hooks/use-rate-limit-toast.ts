"use client";

import { useEffect } from "react";
import { toast } from "sonner";

interface RateLimitedState {
  rateLimitError?: string;
}

/**
 * Toasts the rate-limit message of each action result that carries one. Every
 * result is a new object, so a second blocked attempt toasts again.
 */
export function useRateLimitToast(state: RateLimitedState) {
  useEffect(() => {
    if (state.rateLimitError) {
      toast.error(state.rateLimitError);
    }
  }, [state]);
}
