import Link from "next/link";
import { Clock, Pin } from "lucide-react";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { getRecentCollections } from "@/lib/db/collections";
import { getPinnedItems, getRecentItems, type ItemSummary } from "@/lib/db/items";

interface ItemSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ItemSummary[];
  /** Shown when the list is empty. Omit to drop the section instead. */
  emptyMessage?: string;
}

function ItemSection({ title, icon, items, emptyMessage }: ItemSectionProps) {
  if (items.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
        {icon}
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage() {
  const [collections, pinnedItems, recentItems] = await Promise.all([
    getRecentCollections(),
    getPinnedItems(),
    getRecentItems(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header>
        <h1 className="font-heading text-3xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Your developer knowledge hub
        </p>
      </header>

      <StatsCards />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-xl font-semibold">Collections</h2>
          <Link
            href="/collections"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
        </div>

        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collections yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </section>

      {/* Nothing to pin, nothing to show - the section disappears entirely. */}
      <ItemSection
        title="Pinned"
        icon={<Pin aria-hidden className="size-5 text-muted-foreground" />}
        items={pinnedItems}
      />

      <ItemSection
        title="Recent"
        icon={<Clock aria-hidden className="size-5 text-muted-foreground" />}
        items={recentItems}
        emptyMessage="No items yet."
      />
    </div>
  );
}
