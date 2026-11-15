"use client";

import { Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FAVORITES_PATH = "/favorites";

/**
 * The top bar's star, linking to /favorites. A plain link styled as a button
 * (Base UI's Button would add role="button"); the star fills while there.
 */
export function FavoritesLink() {
  const active = usePathname() === FAVORITES_PATH;

  return (
    <Link
      href={FAVORITES_PATH}
      aria-label="Favorites"
      aria-current={active ? "page" : undefined}
      className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
    >
      <Star aria-hidden className={cn(active && "fill-amber-400 text-amber-400")} />
    </Link>
  );
}
