"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { SidebarUser } from "@/components/dashboard/SidebarUser";
import { Separator } from "@/components/ui/separator";
import type { SidebarCollections } from "@/lib/db/collections";
import type { ItemTypeCount } from "@/lib/db/items";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

interface SidebarBodyProps {
  itemTypes: ItemTypeCount[];
  collections: SidebarCollections;
  user: SessionUser;
  collapsed: boolean;
  /** Called after a link is followed - closes the drawer on mobile. */
  onNavigate?: () => void;
}

/** Shared sidebar content for both the desktop column and the mobile drawer. */
export function SidebarBody({
  itemTypes,
  collections,
  user,
  collapsed,
  onNavigate,
}: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "flex h-16 shrink-0 items-center px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Logo
          showName={!collapsed}
          tileClassName="bg-sidebar-primary text-sidebar-primary-foreground"
        />
      </Link>

      <SidebarNav
        itemTypes={itemTypes}
        collections={collections}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      <Separator />
      <SidebarUser user={user} collapsed={collapsed} />
    </div>
  );
}
