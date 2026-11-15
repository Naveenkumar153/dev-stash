"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

/** What a toggle's save returns: the `{ success, error }` part of an action result. */
export interface ToggleSaveResult {
  success: boolean;
  error: string | null;
}

export interface OptimisticToggleOptions {
  /** Toasted once a save succeeds, for the state that was saved. */
  messages: { on: string; off: string };
  /** Toasted when a save fails without its own error, or the call throws. */
  failedMessage: string;
  /** Runs with the saved state, for views that hold their own copy (the drawer). */
  onSaved?: (value: boolean) => void;
}

/**
 * On/off state for a toggle backed by a server action that takes the wanted
 * state. A click shows the new state at once; the save runs in a transition
 * and toasts the saved state; if it fails the state falls back to the saved
 * one with an error toast. The actions re-render the page on success, so the
 * prop catches up with what was shown. Clicks during a save are ignored.
 */
export function useOptimisticToggle(
  value: boolean,
  save: (next: boolean) => Promise<ToggleSaveResult>,
  { messages, failedMessage, onSaved }: OptimisticToggleOptions,
) {
  const [shown, setShown] = useOptimistic(value);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) {
      return;
    }
    const next = !shown;

    startTransition(async () => {
      setShown(next);

      let result: ToggleSaveResult;
      try {
        result = await save(next);
      } catch {
        // A dropped connection rejects the action call instead of returning.
        toast.error(failedMessage);
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? failedMessage);
        return;
      }

      toast.success(next ? messages.on : messages.off);
      if (onSaved) {
        // Updates after an await need their own transition to join this one.
        startTransition(() => onSaved(next));
      }
    });
  }

  return { value: shown, pending, toggle };
}
