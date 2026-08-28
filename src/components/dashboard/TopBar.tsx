import { FolderPlus, Plus, Search } from "lucide-react";

import { SidebarToggle } from "@/components/dashboard/SidebarToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Dashboard top bar. Apart from the sidebar toggle this is display only - the
 * search field and the two actions are not wired up to any behaviour yet.
 */
export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <SidebarToggle />

      <div className="relative min-w-0 flex-1 max-w-lg">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          placeholder="Search items..."
          aria-label="Search items"
          className="h-10 pl-9 pr-4 sm:pr-16"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground sm:flex">
          <span className="text-sm">&#8984;</span>K
        </kbd>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button variant="outline" size="lg" aria-label="New collection">
          <FolderPlus />
          <span className="hidden sm:inline">New Collection</span>
        </Button>
        <Button size="lg" aria-label="New item">
          <Plus />
          <span className="hidden sm:inline">New Item</span>
        </Button>
      </div>
    </header>
  );
}
