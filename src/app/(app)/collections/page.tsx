import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Library } from "lucide-react";

import { IconTile } from "@/components/common/IconTile";
import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListPagination } from "@/components/pagination/ListPagination";
import { getCollectionPage } from "@/lib/db/collections";
import { formatCount } from "@/lib/format";
import {
  COLLECTIONS_PER_PAGE,
  getPageHref,
  getTotalPages,
  parsePageParam,
} from "@/lib/pagination";

const PATHNAME = "/collections";

export const metadata: Metadata = { title: "Collections | DevStash" };

/** The user's collections, a page at a time, as the dashboard's cards. */
export default async function CollectionsPage({ searchParams }: PageProps<"/collections">) {
  const page = parsePageParam((await searchParams).page);

  if (page === null) {
    redirect(PATHNAME);
  }

  const { rows: collections, total } = await getCollectionPage(page);
  const totalPages = getTotalPages(total, COLLECTIONS_PER_PAGE);

  // Past the last page - a deleted collection can leave it empty - show the last.
  if (page > totalPages) {
    redirect(getPageHref(PATHNAME, totalPages));
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8">
      <PageHeader
        icon={<IconTile icon={Library} size="lg" />}
        title="Collections"
        subtitle={formatCount(total, "collection")}
      />

      <section aria-labelledby="collection-list-heading" className="flex flex-1 flex-col">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="collection-list-heading" className="sr-only">
          All collections
        </h2>

        {collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collections yet. Create one with New Collection.
          </p>
        ) : (
          <div className="flex flex-1 flex-col gap-8">
            <div className="@container">
              <div className="grid gap-4 @xl:grid-cols-2 @[60rem]:grid-cols-3">
                {collections.map((collection) => (
                  <CollectionCard key={collection.id} collection={collection} />
                ))}
              </div>
            </div>
            <ListPagination
              pathname={PATHNAME}
              page={page}
              totalPages={totalPages}
              label="Collections pages"
            />
          </div>
        )}
      </section>
    </div>
  );
}
