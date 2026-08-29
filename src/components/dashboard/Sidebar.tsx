"use client";

import { SidebarBody } from "@/components/dashboard/SidebarBody";
import { useSidebar } from "@/components/dashboard/SidebarProvider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SidebarCollections } from "@/lib/db/collections";
import type { ItemTypeCount } from "@/lib/db/items";

interface SidebarProps {
  itemTypes: ItemTypeCount[];
  collections: SidebarCollections;
}

/**
 * A collapsible column on desktop, a drawer on mobile. Both render the same
 * content - only the shell differs. The rows are fetched in the layout, so only
 * plain data crosses into the client; icons and colors resolve from type names.
 */
export function Sidebar({ itemTypes, collections }: SidebarProps) {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      <aside
        data-collapsed={isCollapsed}
        className="hidden h-svh w-64 shrink-0 border-r border-border transition-[width] duration-200 ease-in-out data-[collapsed=true]:w-16 md:block"
      >
        <SidebarBody
          itemTypes={itemTypes}
          collections={collections}
          collapsed={isCollapsed}
        />
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64! max-w-64! gap-0 bg-sidebar p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Item types and collections
          </SheetDescription>
          <SidebarBody
            itemTypes={itemTypes}
            collections={collections}
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
