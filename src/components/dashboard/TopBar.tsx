import { NewCollectionDialog } from "@/components/collections/NewCollectionDialog";
import { SidebarToggle } from "@/components/dashboard/SidebarToggle";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { SearchTrigger } from "@/components/search/SearchTrigger";

/**
 * Dashboard top bar: the sidebar toggle, the search field that opens the
 * command palette, New Collection and New Item.
 */
export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
      <SidebarToggle />

      <SearchTrigger />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NewCollectionDialog />
        <NewItemDialog />
      </div>
    </header>
  );
}
