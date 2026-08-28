"use client";

import { PanelLeft } from "lucide-react";

import { useSidebar } from "@/components/dashboard/SidebarProvider";
import { Button } from "@/components/ui/button";

/** Drawer icon in the top bar that opens/closes the sidebar. */
export function SidebarToggle() {
  const { isCollapsed, isMobile, isMobileOpen, toggleSidebar } = useSidebar();
  const isExpanded = isMobile ? isMobileOpen : !isCollapsed;

  return (
    <Button
      variant="ghost"
      size="icon-lg"
      onClick={toggleSidebar}
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      <PanelLeft />
    </Button>
  );
}