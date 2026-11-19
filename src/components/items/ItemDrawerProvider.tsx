"use client";

import type { Dialog } from "@base-ui/react/dialog";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ItemDrawer } from "@/components/items/ItemDrawer";
import { useItemDetail } from "@/hooks/use-item-detail";
import type { ItemDrawerSummary } from "@/types/items";

interface ItemDrawerContextValue {
  /** Opens the drawer on an item and starts loading its full detail. */
  openItem: (item: ItemDrawerSummary) => void;
}

const ItemDrawerContext = createContext<ItemDrawerContextValue | null>(null);

/**
 * How soon after opening a press on the backdrop is taken as the second click
 * of the double-click that opened it, rather than a wish to close. The
 * backdrop appears under the pointer between the two clicks.
 */
const DOUBLE_CLICK_GRACE_MS = 500;

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
  const [summary, setSummary] = useState<ItemDrawerSummary | null>(null);
  const { detail, load, replace, patch } = useItemDetail();
  const openedAt = useRef(0);

  const openItem = useCallback(
    (item: ItemDrawerSummary) => {
      openedAt.current = performance.now();
      setSummary(item);
      setOpen(true);
      void load(item.id);
    },
    [load],
  );

  const value = useMemo(() => ({ openItem }), [openItem]);

  // The summary stays, so the drawer animates out with the deleted item's header.
  const closeDrawer = useCallback(() => setOpen(false), []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean, details: Dialog.Root.ChangeEventDetails) => {
      const justOpened = performance.now() - openedAt.current < DOUBLE_CLICK_GRACE_MS;
      if (!nextOpen && details.reason === "outside-press" && justOpened) {
        return;
      }
      setOpen(nextOpen);
    },
    [],
  );

  return (
    <ItemDrawerContext value={value}>
      {children}
      <ItemDrawer
        open={open}
        onOpenChange={handleOpenChange}
        summary={summary}
        detail={detail}
        onItemSaved={replace}
        onItemPatched={patch}
        onItemDeleted={closeDrawer}
      />
    </ItemDrawerContext>
  );
}
