"use client";

import { SidebarBody } from "@/components/dashboard/SidebarBody";
import { useSidebar } from "@/components/dashboard/SidebarProvider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * A collapsible column on desktop, a drawer on mobile. Both render the same
 * content - only the shell differs.
 */
export function Sidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      <aside
        data-collapsed={isCollapsed}
        className="hidden h-svh w-64 shrink-0 border-r border-border transition-[width] duration-200 ease-in-out data-[collapsed=true]:w-16 md:block"
      >
        <SidebarBody collapsed={isCollapsed} />
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
            collapsed={false}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
