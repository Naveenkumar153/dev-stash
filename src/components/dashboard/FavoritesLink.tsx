"use client";

import { Star } from "lucide-react";
import { usePathname } from "next/navigation";

import { ButtonLink } from "@/components/common/ButtonLink";
import { cn } from "@/lib/utils";

export const FAVORITES_PATH = "/favorites";

/**
 * The top bar's star, linking to /favorites. A plain link styled as a button
 * (Base UI's Button would add role="button"); the star fills while there.
 */
export function FavoritesLink({ className }: Readonly<{ className?: string }>) {
  const active = usePathname() === FAVORITES_PATH;

  return (
    <ButtonLink
      href={FAVORITES_PATH}
      aria-label="Favorites"
      aria-current={active ? "page" : undefined}
      variant="ghost"
      size="icon-lg"
      className={className}
    >
      <Star aria-hidden className={cn(active && "fill-amber-400 text-amber-400")} />
    </ButtonLink>
  );
}
