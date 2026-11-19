"use client";

import { ArrowRight, Folder, Star } from "lucide-react";

import { useProAccess } from "@/components/billing/ProAccessProvider";
import { ProBadge } from "@/components/billing/ProBadge";
import { FAVORITES_PATH } from "@/components/dashboard/FavoritesLink";
import { CollectionDot, GroupLabel, NavGroup, NavRow } from "@/components/dashboard/SidebarNavParts";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SidebarCollections } from "@/lib/db/collections";
import type { ItemTypeCount } from "@/lib/db/items";
import {
  getItemTypeHref,
  getItemTypePlural,
  getItemTypeStyleByName,
  isProItemType,
} from "@/lib/item-types";
import { UPGRADE_PATH } from "@/lib/plans";
import { cn } from "@/lib/utils";

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
  const hasProAccess = useProAccess();

  return (
    <TooltipProvider>
      <nav
        aria-label="Sidebar"
        className={cn("flex-1 overflow-y-auto py-2", collapsed ? "px-3" : "px-2")}
      >
        {/* Also the top bar's star, which hides when the bar is narrow. */}
        <NavRow
          href={FAVORITES_PATH}
          label="Favorites"
          collapsed={collapsed}
          onNavigate={onNavigate}
          icon={<Star className="size-4 text-amber-400" />}
        />

        <Separator className="my-3" />

        <NavGroup title="Types" collapsed={collapsed}>
          {itemTypes.map((type) => {
            const { icon: Icon, colorClass } = getItemTypeStyleByName(type.name);
            const isPro = isProItemType(type.name);
            const listHref = getItemTypeHref(type.name);

            return (
              <NavRow
                key={type.id}
                // Straight to /upgrade when locked, so the list page never
                // starts loading before the server redirects away from it.
                href={isPro && !hasProAccess ? UPGRADE_PATH : listHref}
                activePath={listHref}
                label={getItemTypePlural(type.name)}
                badge={isPro ? <ProBadge /> : undefined}
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
