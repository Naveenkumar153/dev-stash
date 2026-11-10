"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { ItemDrawer } from "@/components/items/ItemDrawer";
import { useItemDetail } from "@/hooks/use-item-detail";
import type { ItemSummary } from "@/lib/db/items";

interface ItemDrawerContextValue {
  /** Opens the drawer on an item and starts loading its full detail. */
  openItem: (item: ItemSummary) => void;
}

const ItemDrawerContext = createContext<ItemDrawerContextValue | null>(null);

export function useItemDrawer() {
  const context = useContext(ItemDrawerContext);

  if (!context) {
    throw new Error("useItemDrawer must be used inside <ItemDrawerProvider>");
  }

  return context;
}

/**
 * Owns the one item drawer for the signed-in app shell. The pages stay server
 * components: each card hands its summary over through `openItem`, which shows
 * the header straight away while the rest is fetched.
 */
export function ItemDrawerProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [open, setOpen] = useState(false);
  // Kept after closing, so the drawer still has content while it animates out.
  const [summary, setSummary] = useState<ItemSummary | null>(null);
  const { detail, load } = useItemDetail();

  const openItem = useCallback(
    (item: ItemSummary) => {
      setSummary(item);
      setOpen(true);
      void load(item.id);
    },
    [load],
  );

  const value = useMemo(() => ({ openItem }), [openItem]);

  return (
    <ItemDrawerContext value={value}>
      {children}
      <ItemDrawer
        open={open}
        onOpenChange={setOpen}
        summary={summary}
        detail={detail}
      />
    </ItemDrawerContext>
  );
}
