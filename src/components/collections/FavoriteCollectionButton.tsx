import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The collection page's Favorite button. It shows the collection's state but
 * stays disabled until favoriting is built, like the item drawer's Favorite.
 */
export function FavoriteCollectionButton({ isFavorite }: Readonly<{ isFavorite: boolean }>) {
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Favorite"
      aria-pressed={isFavorite}
      disabled
      className={cn(isFavorite && "text-amber-400")}
    >
      <Star aria-hidden className={cn(isFavorite && "fill-amber-400")} />
    </Button>
  );
}
