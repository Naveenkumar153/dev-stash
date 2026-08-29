"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { SidebarUser } from "@/components/dashboard/SidebarUser";
import { Separator } from "@/components/ui/separator";
import type { SidebarCollections } from "@/lib/db/collections";
import type { ItemTypeCount } from "@/lib/db/items";
import { cn } from "@/lib/utils";

interface SidebarBodyProps {
  itemTypes: ItemTypeCount[];
  collections: SidebarCollections;
  collapsed: boolean;
  /** Called after a link is followed - closes the drawer on mobile. */
  onNavigate?: () => void;
}

/** Shared sidebar content for both the desktop column and the mobile drawer. */
export function SidebarBody({
  itemTypes,
  collections,
  collapsed,
  onNavigate,
}: SidebarBodyProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Layers aria-hidden className="size-5" />
        </span>
        {!collapsed && (
          <span className="font-heading text-lg font-semibold">DevStash</span>
        )}
      </Link>

      <SidebarNav
        itemTypes={itemTypes}
        collections={collections}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      <Separator />
      <SidebarUser collapsed={collapsed} />
    </div>
  );
}
