import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { ChevronLeft, FolderOpen } from "lucide-react";

import { IconTile } from "@/components/common/IconTile";
import { CollectionActions } from "@/components/collections/CollectionActions";
import { ItemCard } from "@/components/dashboard/ItemCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { ListPagination } from "@/components/pagination/ListPagination";
import { collectionIdSchema } from "@/lib/collection-schemas";
import { getCollection } from "@/lib/db/collections";
import { getCollectionItems } from "@/lib/db/items";
import { formatCount } from "@/lib/format";
import {
  getPageHref,
  getTotalPages,
  ITEMS_PER_PAGE,
  parsePageParam,
} from "@/lib/pagination";

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

/** One collection's items, a page at a time, as the cards the other lists use. */
export default async function CollectionPage({
  params,
  searchParams,
}: PageProps<"/collections/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const pathname = `/collections/${encodeURIComponent(id)}`;
  const page = parsePageParam(query.page);

  if (page === null) {
    redirect(pathname);
  }

  // A malformed id is a 404 without a query.
  if (!collectionIdSchema.safeParse(id).success) {
    notFound();
  }

  // Together: the items query is scoped to the user too, so it doesn't need
  // the collection first, and a missing collection simply returns no items.
  const [collection, { rows: items, total }] = await Promise.all([
    findCollection(id),
    getCollectionItems(id, page),
  ]);

  if (!collection) {
    notFound();
  }
  const totalPages = getTotalPages(total, ITEMS_PER_PAGE);

  // Past the last page - a deleted item can leave it empty - show the last.
  if (page > totalPages) {
    redirect(getPageHref(pathname, totalPages));
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/collections"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          All collections
        </Link>

        {/* The Favorite button among the actions shows the favorite state. */}
        <PageHeader
          align="start"
          icon={<IconTile icon={FolderOpen} size="lg" />}
          title={collection.name}
          subtitle={formatCount(total, "item")}
          actions={<CollectionActions collection={collection} />}
        >
          {collection.description && (
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              {collection.description}
            </p>
          )}
        </PageHeader>
      </div>

      <section aria-labelledby="collection-items-heading" className="flex flex-1 flex-col">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="collection-items-heading" className="sr-only">
          Items
        </h2>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in this collection yet.</p>
        ) : (
          <div className="flex flex-1 flex-col gap-8">
            {/* Columns follow the list's own width, so the open sidebar doesn't
                squeeze two columns of cards into a tablet screen. */}
            <div className="@container">
              <div className="grid gap-4 @xl:grid-cols-2 @[60rem]:grid-cols-3">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            </div>
            <ListPagination
              pathname={pathname}
              page={page}
              totalPages={totalPages}
              label={`${collection.name} pages`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
