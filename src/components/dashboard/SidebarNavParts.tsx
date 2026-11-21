"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

/*
 * The sidebar's building blocks: a link row (with its collapsed-rail tooltip),
 * a collapsible group, a group label and a collection's type-colored dot.
 * Composed by `SidebarNav`.
 */

interface NavRowProps {
  href: string;
  /** The path that highlights the row, when it isn't `href` (a locked type row links to /upgrade). */
  activePath?: string;
  label: string;
  icon: React.ReactNode;
  /** Shown right after the label, before the trailing meta. */
  badge?: React.ReactNode;
  /** Trailing content - an item count or a favorite star. */
  meta?: React.ReactNode;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function NavRow({
  href,
  activePath = href,
  label,
  icon,
  badge,
  meta,
  collapsed,
  onNavigate,
}: NavRowProps) {
  const pathname = usePathname();
  const isActive = pathname === activePath;
  const rowRef = useRef<HTMLAnchorElement>(null);

  // The list scrolls inside the sidebar, so a row lower down (View all
  // collections) can be the current page while out of sight.
  useEffect(() => {
    if (isActive) {
      rowRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isActive]);

  const row = (
    <Link
      ref={rowRef}
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      // The rail hides the label, and the tooltip doesn't name the link.
      aria-label={collapsed ? label : undefined}
      className={cn(
        "relative flex h-9 items-center rounded-md text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isActive &&
          "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary",
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

export function NavGroup({ title, collapsed, children }: NavGroupProps) {
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

export function GroupLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <p className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Stands in for a collection's folder icon under Recent, colored by the type
 * the collection holds most of. Empty collections get a neutral dot.
 */
export function CollectionDot({ typeName }: Readonly<{ typeName: string | null }>) {
  return (
    <span
      aria-hidden
      // An unknown or missing type falls back to the shared neutral style.
      className={cn("size-2.5 rounded-full", getItemTypeStyleByName(typeName ?? "").dotClass)}
    />
  );
}
