"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { isUpgradeError } from "@/lib/action-result";
import { UPGRADE_PATH } from "@/lib/plans";

/**
 * Toasts a failed create. A Free-plan limit or a Pro-only feature gets an
 * Upgrade action that opens the Billing card on /settings.
 */
export function useUpgradeErrorToast() {
  const router = useRouter();

  return function showError(error: string | null, fallback: string) {
    const message = error ?? fallback;
    if (isUpgradeError(error)) {
      toast.error(message, {
        action: { label: "Upgrade", onClick: () => router.push(UPGRADE_PATH) },
      });
      return;
    }
    toast.error(message);
  };
}
