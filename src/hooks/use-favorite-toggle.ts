"use client";

import { useOptimisticToggle } from "@/hooks/use-optimistic-toggle";
import { FAVORITE_UPDATE_FAILED } from "@/lib/action-result";
import type { SetFavoriteResult } from "@/types/favorites";

const FAVORITE_MESSAGES = { on: "Added to favorites", off: "Removed from favorites" };

/** Favorite state for a star, through `useOptimisticToggle()`. */
export function useFavoriteToggle(
  isFavorite: boolean,
  save: (next: boolean) => Promise<SetFavoriteResult>,
  /** Runs with the saved state, for views that hold their own copy (the drawer). */
  onSaved?: (isFavorite: boolean) => void,
) {
  const { value, pending, toggle } = useOptimisticToggle(isFavorite, save, {
    messages: FAVORITE_MESSAGES,
    failedMessage: FAVORITE_UPDATE_FAILED,
    onSaved,
  });

  return { isFavorite: value, pending, toggle };
}
