import { FavoritesLink } from "@/components/dashboard/FavoritesLink";
import { NewMenu } from "@/components/dashboard/NewMenu";
import { SidebarToggle } from "@/components/dashboard/SidebarToggle";
import { UpgradeLink } from "@/components/dashboard/UpgradeLink";
import { SearchTrigger } from "@/components/search/SearchTrigger";

/**
 * Dashboard top bar: the sidebar toggle, search, the Favorites star, a quiet
 * Upgrade link for Free users and the New menu. It's a `topbar` size container,
 * so its controls respond to the bar's own width - which the open sidebar
 * narrows - rather than the screen's: search is an icon until the bar has 28rem
 * of room, Upgrade's word shows from 22rem, and the star (also in the sidebar's
 * nav) shows from 40rem.
 */
interface TopBarProps {
  /** The stored plan; Free users get the Upgrade link. */
  isPro: boolean;
}

export function TopBar({ isPro }: Readonly<TopBarProps>) {
  return (
    <header className="@container/topbar flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <SidebarToggle />

      <SearchTrigger />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <FavoritesLink className="hidden @[40rem]/topbar:inline-flex" />
        {!isPro && <UpgradeLink />}
        <NewMenu />
      </div>
    </header>
  );
}
