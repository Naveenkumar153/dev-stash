import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getItemsByType } from "@/lib/db/items";
import { getItemTypePlural, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/items/[type]">): Promise<Metadata> {
  const { type: slug } = await params;
  const itemType = await getItemTypeBySlug(slug);

  return { title: `${itemType ? getItemTypePlural(itemType.name) : "Items"} | DevStash` };
}

/** One page for every type: /items/snippets, /items/links, ... */
export default async function ItemTypePage({ params }: PageProps<"/items/[type]">) {
  const { type: slug } = await params;
  const list = await getItemsByType(slug);

  if (!list) {
    notFound();
  }

  const { typeName, items } = list;
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(typeName);
  const plural = getItemTypePlural(typeName);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-lg",
            bgClass,
          )}
        >
          <Icon aria-hidden className={cn("size-6", colorClass)} />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-semibold">{plural}</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
      </header>

      <section aria-labelledby="item-list-heading">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="item-list-heading" className="sr-only">
          {plural}
        </h2>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {plural.toLowerCase()} yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
