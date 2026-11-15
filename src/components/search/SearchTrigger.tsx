"use client";

import { Search } from "lucide-react";

import { useSearchPalette } from "@/components/search/SearchPaletteProvider";

/**
 * The top bar's search field. It looks like an input but is a button that
 * opens the command palette, where the typing happens - a real input here
 * would take text the palette then had to carry over.
 */
export function SearchTrigger() {
  const { openPalette } = useSearchPalette();

  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="Search items"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className="relative flex h-10 w-full min-w-0 max-w-lg flex-1 cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent pl-9 pr-4 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:pr-16 dark:bg-input/30 dark:hover:bg-input/50"
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
      />
      <span className="truncate">Search items...</span>
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground sm:flex">
        <span className="text-sm">&#8984;</span>K
      </kbd>
    </button>
  );
}
