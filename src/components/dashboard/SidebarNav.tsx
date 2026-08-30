"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, Folder, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SidebarCollections } from "@/lib/db/collections";
import type { ItemTypeCount } from "@/lib/db/items";
import {
  getItemTypeHref,
  getItemTypePlural,
  getItemTypeStyleByName,
  isProItemType,
} from "@/lib/item-types";
import { cn } from "@/lib/utils";

interface NavRowProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Shown right after the label, before the trailing meta. */
  badge?: React.ReactNode;
  /** Trailing content - an item count or a favorite star. */
  meta?: React.ReactNode;
  collapsed: boolean;
  onNavigate?: () => void;
}

function NavRow({
  href,
  label,
  icon,
  badge,
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
          {badge}
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

/** Marks an item type that a Pro subscription unlocks. */
function ProBadge() {
  return (
    <Badge
      variant="outline"
      className="h-4 px-1.5 text-[10px] tracking-wide text-muted-foreground"
    >
      PRO
    </Badge>
  );
}

/**
 * Stands in for a collection's folder icon under Recent, colored by the type
 * the collection holds most of. Empty collections get a neutral dot.
 */
function CollectionDot({ typeName }: Readonly<{ typeName: string | null }>) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 rounded-full",
        typeName
          ? getItemTypeStyleByName(typeName).dotClass
          : "bg-muted-foreground/50",
      )}
    />
  );
}

interface SidebarNavProps {
  itemTypes: ItemTypeCount[];
  collections: SidebarCollections;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({
  itemTypes,
  collections,
  collapsed,
  onNavigate,
}: SidebarNavProps) {
  const { favorites, recent } = collections;
  const hasCollections = favorites.length > 0 || recent.length > 0;

  return (
    <TooltipProvider>
      <nav
        aria-label="Sidebar"
        className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-3" : "px-2")}
      >
        <NavGroup title="Types" collapsed={collapsed}>
          {itemTypes.map((type) => {
            const { icon: Icon, colorClass } = getItemTypeStyleByName(type.name);

            return (
              <NavRow
                key={type.id}
                href={getItemTypeHref(type.name)}
                label={getItemTypePlural(type.name)}
                badge={isProItemType(type.name) ? <ProBadge /> : undefined}
                meta={type.count}
                collapsed={collapsed}
                onNavigate={onNavigate}
                icon={<Icon className={cn("size-4", colorClass)} />}
              />
            );
          })}
        </NavGroup>

        <Separator className="my-3" />

        <NavGroup title="Collections" collapsed={collapsed}>
          {favorites.length > 0 && (
            <>
              {!collapsed && <GroupLabel>Favorites</GroupLabel>}
              {favorites.map((collection) => (
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
            </>
          )}

          {recent.length > 0 && (
            <>
              {!collapsed && <GroupLabel>Recent</GroupLabel>}
              {recent.map((collection) => (
                <NavRow
                  key={collection.id}
                  href={`/collections/${collection.id}`}
                  label={collection.name}
                  meta={collection.itemCount}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  icon={<CollectionDot typeName={collection.dominantTypeName} />}
                />
              ))}
            </>
          )}

          {!hasCollections && !collapsed && (
            <p className="px-3 py-1.5 text-sm text-muted-foreground">
              No collections yet.
            </p>
          )}

          <NavRow
            href="/collections"
            label="View all collections"
            collapsed={collapsed}
            onNavigate={onNavigate}
            icon={<ArrowRight className="size-4 text-muted-foreground" />}
          />
        </NavGroup>
      </nav>
    </TooltipProvider>
  );
}
