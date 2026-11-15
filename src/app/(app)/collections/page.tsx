import type { Metadata } from "next";
import { Library } from "lucide-react";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { getCollections } from "@/lib/db/collections";
import { formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Collections | DevStash" };

/** Every collection the user has, as the dashboard's cards. */
export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <header className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Library aria-hidden className="size-6 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold">Collections</h1>
          <p className="mt-1 text-muted-foreground">
            {formatCount(collections.length, "collection")}
          </p>
        </div>
      </header>

      <section aria-labelledby="collection-list-heading">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="collection-list-heading" className="sr-only">
          All collections
        </h2>

        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collections yet. Create one with New Collection.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
