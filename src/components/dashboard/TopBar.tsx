import { FavoritesLink } from "@/components/dashboard/FavoritesLink";
import { NewMenu } from "@/components/dashboard/NewMenu";
import { SidebarToggle } from "@/components/dashboard/SidebarToggle";
import { SearchTrigger } from "@/components/search/SearchTrigger";

/**
 * Dashboard top bar: the sidebar toggle, search, the Favorites star and the
 * New menu. It's a `topbar` size container, so its controls respond to the
 * bar's own width - which the open sidebar narrows - rather than the screen's:
 * search is an icon until the bar has 28rem of room, and the star (also in the
 * sidebar's nav) shows from 40rem.
 */
export function TopBar() {
  return (
    <header className="@container/topbar flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <SidebarToggle />

      <SearchTrigger />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <FavoritesLink className="hidden @[40rem]/topbar:inline-flex" />
        <NewMenu />
      </div>
    </header>
  );
}
