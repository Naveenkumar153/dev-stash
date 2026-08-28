"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Folder, Star } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getItemTypeNav } from "@/lib/item-types";
import { collections } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const RECENT_COLLECTION_LIMIT = 5;

interface NavRowProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Trailing content - an item count or a favorite star. */
  meta?: React.ReactNode;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavRow({
  href,
  label,
  icon,
  meta,
  collapsed,
  onNavigate,
}: NavRowProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const row = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-9 items-center rounded-md text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        collapsed ? "justify-center" : "gap-3 px-3",
      )}
    >
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      {!collapsed && (
        <>
          <span className="truncate">{label}</span>
          {meta !== undefined && (
            <span className="ml-auto flex shrink-0 items-center text-xs text-muted-foreground">
              {meta}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) {
    return row;
  }

  // The rail hides labels, so the name moves into a tooltip.
  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

interface NavGroupProps {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}

function NavGroup({ title, collapsed, children }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  // The rail has no room for group headers - the rows are always shown.
  if (collapsed) {
    return <div className="flex flex-col gap-0.5">{children}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {title}
        <ChevronDown
          aria-hidden
          className={cn("size-4 transition-transform", !isOpen && "-rotate-90")}
        />
      </button>
      {isOpen && <div className="mt-1 flex flex-col gap-0.5">{children}</div>}
    </div>
  );
}

function GroupLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

interface SidebarNavProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ collapsed, onNavigate }: SidebarNavProps) {
  const typeNav = getItemTypeNav();

  const favoriteCollections = collections.filter(
    (collection) => collection.isFavorite,
  );
  const favoriteIds = new Set(
    favoriteCollections.map((collection) => collection.id),
  );
  const recentCollections = collections
    .filter((collection) => !favoriteIds.has(collection.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_COLLECTION_LIMIT);

  return (
    <TooltipProvider>
      <nav
        aria-label="Sidebar"
        className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-3" : "px-2")}
      >
        <NavGroup title="Types" collapsed={collapsed}>
          {typeNav.map((type) => (
            <NavRow
              key={type.id}
              href={type.href}
              label={type.label}
              meta={type.count}
              collapsed={collapsed}
              onNavigate={onNavigate}
              icon={<type.icon className={cn("size-4", type.colorClass)} />}
            />
          ))}
        </NavGroup>

        <Separator className="my-3" />

        <NavGroup title="Collections" collapsed={collapsed}>
          {!collapsed && <GroupLabel>Favorites</GroupLabel>}
          {favoriteCollections.map((collection) => (
            <NavRow
              key={collection.id}
              href={`/collections/${collection.id}`}
              label={collection.name}
              collapsed={collapsed}
              onNavigate={onNavigate}
              icon={<Folder className="size-4" />}
              meta={
                <Star
                  aria-hidden
                  className="size-3.5 fill-amber-400 text-amber-400"
                />
              }
            />
          ))}

          {!collapsed && <GroupLabel>Recent</GroupLabel>}
          {recentCollections.map((collection) => (
            <NavRow
              key={collection.id}
              href={`/collections/${collection.id}`}
              label={collection.name}
              meta={collection.itemCount}
              collapsed={collapsed}
              onNavigate={onNavigate}
              icon={<Folder className="size-4" />}
            />
          ))}
        </NavGroup>
      </nav>
    </TooltipProvider>
  );
}
