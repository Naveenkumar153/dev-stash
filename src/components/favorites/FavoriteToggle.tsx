"use client";

import { Star } from "lucide-react";

import { setCollectionFavorite } from "@/actions/collections";
import { setItemFavorite } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { useFavoriteToggle } from "@/hooks/use-favorite-toggle";
import { cn } from "@/lib/utils";

interface FavoriteToggleProps {
  kind: "item" | "collection";
  id: string;
  /** The item's title or the collection's name, for the accessible name. */
  name: string;
  isFavorite: boolean;
  /** Runs with the saved state, for views that hold their own copy (the drawer). */
  onSaved?: (isFavorite: boolean) => void;
  variant?: "ghost" | "outline";
  size?: "default" | "icon" | "icon-xs";
  /** Shows "Favorite" beside the star, as in the drawer's action bar. */
  showLabel?: boolean;
  /** Classes for that label, e.g. to show it only from `sm`. */
  labelClassName?: string;
  className?: string;
}

/**
 * A star that favorites or unfavorites an item or a collection. `aria-pressed`
 * carries the state, so the name stays the same either way; the star fills
 * amber while it's on.
 */
export function FavoriteToggle({
  kind,
  id,
  name,
  isFavorite,
  onSaved,
  variant = "ghost",
  size = "icon-xs",
  showLabel = false,
  labelClassName,
  className,
}: Readonly<FavoriteToggleProps>) {
  const save = (next: boolean) =>
    kind === "item" ? setItemFavorite(id, next) : setCollectionFavorite(id, next);
  const { isFavorite: on, toggle } = useFavoriteToggle(isFavorite, save, onSaved);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-pressed={on}
      aria-label={showLabel ? undefined : `Favorite ${name}`}
      onClick={toggle}
      className={cn(on ? "text-amber-400 hover:text-amber-400" : !showLabel && "text-muted-foreground", className)}
    >
      <Star aria-hidden className={cn(on && "fill-amber-400")} />
      {showLabel && <span className={labelClassName}>Favorite</span>}
    </Button>
  );
}
