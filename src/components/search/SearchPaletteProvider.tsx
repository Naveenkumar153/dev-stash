"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useItemDrawer } from "@/components/items/ItemDrawerProvider";
import { CommandPalette } from "@/components/search/CommandPalette";
import { useSearchData } from "@/hooks/use-search-data";
import { toDrawerSummary } from "@/lib/item-summary";
import { isApplePlatform, isPaletteShortcut } from "@/lib/keyboard-shortcuts";
import type { SearchCollection, SearchItem } from "@/types/search";

interface SearchPaletteContextValue {
  /** Opens the command palette and reloads its data in the background. */
  openPalette: () => void;
}

const SearchPaletteContext = createContext<SearchPaletteContextValue | null>(null);

export function useSearchPalette() {
  const context = useContext(SearchPaletteContext);

  if (!context) {
    throw new Error("useSearchPalette must be used inside <SearchPaletteProvider>");
  }

  return context;
}

/** The browser's platform, from User-Agent Client Hints where available. */
function getPlatform(): string {
  const { userAgentData } = navigator as Navigator & { userAgentData?: { platform: string } };

  return userAgentData?.platform || navigator.platform;
}

/**
 * Whether a modal other than the palette is open - a dialog, a confirmation
 * or the item drawer. The shortcut leaves those alone: they trap focus for a
 * reason, and a pick would navigate or swap the drawer out from under a draft
 * or a running delete.
 */
function isOtherModalOpen(): boolean {
  return document.querySelector('[role="dialog"][data-open], [role="alertdialog"][data-open]') !== null;
}

/**
 * Owns the one command palette for the signed-in app shell: its data, loaded
 * when the shell mounts; the Cmd/Ctrl+K shortcut; and what a result does when
 * picked. Sits inside `ItemDrawerProvider`, so an item opens in the drawer.
 * The shortcut uses the platform's own modifier and does nothing while another
 * modal, the drawer included, is open.
 */
export function SearchPaletteProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const { openItem } = useItemDrawer();
  const { data, error, refresh } = useSearchData();
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        refresh();
      }
    },
    [refresh],
  );

  const openPalette = useCallback(() => handleOpenChange(true), [handleOpenChange]);

  // Read by the shortcut, which toggles, without re-adding the listener per open.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const isApple = isApplePlatform(getPlatform());

    function handleKeyDown(event: KeyboardEvent) {
      // A focused code editor may have claimed the keys for its own chord.
      if (event.defaultPrevented || event.repeat || !isPaletteShortcut(event, isApple)) {
        return;
      }

      // The palette's own popup counts as open, so check that first.
      if (!openRef.current && isOtherModalOpen()) {
        return;
      }

      event.preventDefault();
      handleOpenChange(!openRef.current);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenChange]);

  const selectItem = useCallback(
    (item: SearchItem) => {
      setOpen(false);
      openItem(toDrawerSummary(item));
    },
    [openItem],
  );

  const selectCollection = useCallback(
    (collection: SearchCollection) => {
      setOpen(false);
      router.push(`/collections/${collection.id}`);
    },
    [router],
  );

  const value = useMemo(() => ({ openPalette }), [openPalette]);

  return (
    <SearchPaletteContext value={value}>
      {children}
      <CommandPalette
        open={open}
        onOpenChange={handleOpenChange}
        data={data}
        error={error}
        onSelectItem={selectItem}
        onSelectCollection={selectCollection}
      />
    </SearchPaletteContext>
  );
}
