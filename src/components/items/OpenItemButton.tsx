"use client";

import { useItemDrawer } from "@/components/items/ItemDrawerProvider";
import type { ItemSummary } from "@/lib/db/items";
import { cn } from "@/lib/utils";

interface OpenItemButtonProps {
  item: ItemSummary;
  className?: string;
  children: React.ReactNode;
}

/**
 * The card title as a button that opens the item drawer. Its ::after stretches
 * over the nearest positioned ancestor (the card), so the whole card is the
 * click target while the button keeps the accessible name and the focus stop.
 * The card stays a server component; this is its only client part.
 */
export function OpenItemButton({ item, className, children }: Readonly<OpenItemButtonProps>) {
  const { openItem } = useItemDrawer();

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => openItem(item)}
      className={cn(
        "cursor-pointer text-left outline-none after:absolute after:inset-0",
        className,
      )}
    >
      {children}
    </button>
  );
}
