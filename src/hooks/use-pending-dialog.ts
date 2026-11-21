"use client";

import { useTransition, type TransitionStartFunction } from "react";

interface PendingDialog {
  pending: boolean;
  startTransition: TransitionStartFunction;
  /** Pass to the dialog's `onOpenChange`: it ignores closing while `pending`. */
  handleOpenChange: (open: boolean) => void;
}

/**
 * The transition a dialog runs its action in, plus an `onOpenChange` that
 * Escape, the backdrop and the X can't use to close it mid-action, so the
 * user always sees how the action ended.
 */
export function usePendingDialog(onOpenChange: (open: boolean) => void): PendingDialog {
  const [pending, startTransition] = useTransition();

  function handleOpenChange(open: boolean) {
    if (!pending) {
      onOpenChange(open);
    }
  }

  return { pending, startTransition, handleOpenChange };
}
