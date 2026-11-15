"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { FAVORITE_UPDATE_FAILED } from "@/lib/action-result";
import type { SetFavoriteResult } from "@/types/favorites";

/**
 * Favorite state for a toggle. A click shows the new state at once; the save
 * runs in a transition and toasts the saved state; if it fails the state falls
 * back to the saved one with an error toast. The actions re-render the page on success, so the prop
 * catches up with what was shown. Clicks during a save are ignored.
 */
export function useFavoriteToggle(
  isFavorite: boolean,
  save: (next: boolean) => Promise<SetFavoriteResult>,
  /** Runs with the saved state, for views that hold their own copy (the drawer). */
  onSaved?: (isFavorite: boolean) => void,
) {
  const [shown, setShown] = useOptimistic(isFavorite);
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (pending) {
      return;
    }
    const next = !shown;

    startTransition(async () => {
      setShown(next);

      let result: SetFavoriteResult;
      try {
        result = await save(next);
      } catch {
        // A dropped connection rejects the action call instead of returning.
        toast.error(FAVORITE_UPDATE_FAILED);
        return;
      }

      if (!result.success || !result.data) {
        toast.error(result.error ?? FAVORITE_UPDATE_FAILED);
        return;
      }

      const saved = result.data.isFavorite;
      toast.success(saved ? "Added to favorites" : "Removed from favorites");
      if (onSaved) {
        // Updates after an await need their own transition to join this one.
        startTransition(() => onSaved(saved));
      }
    });
  }

  return { isFavorite: shown, pending, toggle };
}
