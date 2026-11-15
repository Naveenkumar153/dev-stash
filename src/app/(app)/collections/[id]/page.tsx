import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ChevronLeft, FolderOpen, Star } from "lucide-react";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { collectionIdSchema } from "@/lib/collection-schemas";
import { getCollection } from "@/lib/db/collections";
import { getCollectionItems } from "@/lib/db/items";
import { formatCount } from "@/lib/format";

/**
 * The collection when `id` is a well-formed id of one of the user's; null
 * otherwise, without a query for a malformed id. Cached so the metadata and
 * the page share one lookup per request.
 */
const findCollection = cache(async (id: string) =>
  collectionIdSchema.safeParse(id).success ? getCollection(id) : null,
);

export async function generateMetadata({
  params,
}: PageProps<"/collections/[id]">): Promise<Metadata> {
  const { id } = await params;
  const collection = await findCollection(id);

  return { title: `${collection?.name ?? "Collection"} | DevStash` };
}

/** One collection's items, as the same cards the other lists use. */
export default async function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  const collection = await findCollection(id);

  if (!collection) {
    notFound();
  }

  const items = await getCollectionItems(collection.id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/collections"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          All collections
        </Link>

        <header className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
            <FolderOpen aria-hidden className="size-6 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-heading text-3xl font-semibold">
              <span className="break-words">{collection.name}</span>
              {collection.isFavorite && (
                <Star
                  aria-label="Favorite"
                  className="size-5 shrink-0 fill-amber-400 text-amber-400"
                />
              )}
            </h1>
            <p className="mt-1 text-muted-foreground">{formatCount(items.length, "item")}</p>
            {collection.description && (
              <p className="mt-3 max-w-prose text-sm text-muted-foreground">
                {collection.description}
              </p>
            )}
          </div>
        </header>
      </div>

      <section aria-labelledby="collection-items-heading">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="collection-items-heading" className="sr-only">
          Items
        </h2>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in this collection yet.</p>
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
