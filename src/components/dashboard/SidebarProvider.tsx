"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarContextValue {
  /** Viewport is below `md` - the sidebar is a drawer instead of a column. */
  isMobile: boolean;
  /** Desktop only: the sidebar is showing as an icon-only rail. */
  isCollapsed: boolean;
  /** Mobile only: the drawer is open. */
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  /** Collapses the rail on desktop, opens/closes the drawer on mobile. */
  toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used inside <SidebarProvider>");
  }

  return context;
}

export function SidebarProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // The drawer only exists on mobile, so growing back into the desktop layout
  // closes it. Derived rather than reset in an effect to avoid a second render.
  const isMobileOpen = isMobile && mobileOpen;

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileOpen((open) => !open);
    } else {
      setIsCollapsed((collapsed) => !collapsed);
    }
  }, [isMobile]);

  const value = useMemo(
    () => ({
      isMobile,
      isCollapsed,
      isMobileOpen,
      setMobileOpen,
      toggleSidebar,
    }),
    [isMobile, isCollapsed, isMobileOpen, toggleSidebar],
  );

  return <SidebarContext value={value}>{children}</SidebarContext>;
}
