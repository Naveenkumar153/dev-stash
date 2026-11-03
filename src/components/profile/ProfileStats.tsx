import { Folder, Layers, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileStats as ProfileStatsData } from "@/lib/db/profile";
import { getItemTypePlural, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

interface TotalProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

function Total({ label, value, icon: Icon }: TotalProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon aria-hidden className="size-4" />
        {label}
      </div>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

interface ProfileStatsProps {
  stats: ProfileStatsData;
}

/** Totals plus one row per item type, zeros included. */
export function ProfileStats({ stats }: ProfileStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Total label="Items" value={stats.items} icon={Layers} />
          <Total label="Collections" value={stats.collections} icon={Folder} />
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {stats.types.map((type) => {
            const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(type.name);
            return (
              <li key={type.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <span className={cn("rounded-md p-1.5", bgClass)}>
                  <Icon aria-hidden className={cn("size-4", colorClass)} />
                </span>
                <span className="flex-1 text-sm">{getItemTypePlural(type.name)}</span>
                <span className="text-sm font-medium tabular-nums">{type.count}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
