import { Folder, FolderHeart, Layers, Star, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardStats } from "@/lib/db/stats";

interface Stat {
  label: string;
  value: number;
  icon: LucideIcon;
}

interface StatsCardsProps {
  stats: DashboardStats;
}

function StatCard({ label, value, icon: Icon }: Stat) {
  return (
    <Card className="gap-2 px-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        <span className="truncate text-xs sm:text-sm">{label}</span>
      </div>
      <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

/**
 * Totals for the user's stash, shown at the top of the dashboard. The counts are
 * loaded by the page: awaiting them here would not start until the page's own
 * queries had already resolved, making them a second round trip.
 */
export function StatsCards({ stats }: StatsCardsProps) {
  const cards: Stat[] = [
    { label: "Items", value: stats.items, icon: Layers },
    { label: "Collections", value: stats.collections, icon: Folder },
    { label: "Favorite items", value: stats.favoriteItems, icon: Star },
    {
      label: "Favorite collections",
      value: stats.favoriteCollections,
      icon: FolderHeart,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </div>
  );
}
