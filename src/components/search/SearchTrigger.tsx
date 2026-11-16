"use client";

import { Search } from "lucide-react";

import { useSearchPalette } from "@/components/search/SearchPaletteProvider";
import { Button } from "@/components/ui/button";

const SHARED_PROPS = {
  type: "button",
  "aria-haspopup": "dialog",
  "aria-keyshortcuts": "Meta+K Control+K",
} as const;

/**
 * The top bar's search, which opens the command palette. Sized by the top
 * bar's width (its `topbar` container), not the screen's: a plain icon button
 * while the bar is narrow, so it doesn't squeeze the other controls, and a
 * field-like button with the shortcut hint once there's room. Neither is a
 * real input - the typing happens in the palette.
 */
export function SearchTrigger() {
  const { openPalette } = useSearchPalette();

  return (
    <>
      <Button
        {...SHARED_PROPS}
        variant="ghost"
        size="icon-lg"
        onClick={openPalette}
        aria-label="Search"
        className="@[28rem]/topbar:hidden"
      >
        <Search aria-hidden />
      </Button>

      <button
        {...SHARED_PROPS}
        onClick={openPalette}
        aria-label="Search items"
        className="relative hidden h-10 w-full min-w-0 max-w-lg flex-1 cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent pr-16 pl-9 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:pr-4 @[28rem]/topbar:flex dark:bg-input/30 dark:hover:bg-input/50"
      >
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        />
        <span className="truncate">Search items...</span>
        {/* Touch screens have no keyboard shortcut to hint at. */}
        <kbd className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground select-none pointer-coarse:hidden">
          <span className="text-sm">&#8984;</span>K
        </kbd>
      </button>
    </>
  );
}
