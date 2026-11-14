import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { FileList } from "@/components/items/FileList";
import { ImageCard } from "@/components/items/ImageCard";
import { NewFolderButton } from "@/components/items/NewFolderButton";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { getFolders } from "@/lib/db/folders";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getItemsByType } from "@/lib/db/items";
import { folderIdSchema } from "@/lib/folder-schemas";
import type { FolderEntry } from "@/lib/folders";
import {
  getItemTypePlural,
  getItemTypeSlug,
  getItemTypeStyleByName,
  isCreatableItemType,
} from "@/lib/item-types";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/items/[type]">): Promise<Metadata> {
  const { type: slug } = await params;
  const itemType = await getItemTypeBySlug(slug);

  return { title: `${itemType ? getItemTypePlural(itemType.name) : "Items"} | DevStash` };
}

/**
 * The folder `?folder=` opens on the files page: null for the top level, the
 * folder when it's one of `folders`, and undefined for anything else - an
 * unknown id, another user's, a malformed one or a repeated parameter.
 */
function resolveOpenFolder(
  param: string | string[] | undefined,
  folders: FolderEntry[],
): FolderEntry | null | undefined {
  if (param === undefined) {
    return null;
  }
  if (typeof param !== "string" || !folderIdSchema.safeParse(param).success) {
    return undefined;
  }

  return folders.find((folder) => folder.id === param);
}

/** One page for every type: /items/snippets, /items/links, ... */
export default async function ItemTypePage({
  params,
  searchParams,
}: PageProps<"/items/[type]">) {
  const [{ type: slug }, query] = await Promise.all([params, searchParams]);
  const isFilesPage = slug === getItemTypeSlug("file");
  const [list, folders] = await Promise.all([
    getItemsByType(slug),
    isFilesPage ? getFolders() : [],
  ]);

  if (!list) {
    notFound();
  }

  const { typeName, items } = list;
  // Folders exist only on the files page; other types ignore the parameter.
  const openFolder = isFilesPage ? resolveOpenFolder(query.folder, folders) : null;

  if (openFolder === undefined) {
    notFound();
  }
  const { icon: Icon, colorClass, bgClass } = getItemTypeStyleByName(typeName);
  const plural = getItemTypePlural(typeName);
  // Images get a thumbnail gallery; every other type keeps the row cards.
  const Card = typeName === "image" ? ImageCard : ItemCard;

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
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-3xl font-semibold">{plural}</h1>
          <p className="mt-1 text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        {isFilesPage && (
          <NewFolderButton parentId={openFolder?.id ?? null} parentName={openFolder?.name ?? null} />
        )}
        {isCreatableItemType(typeName) && (
          <NewItemDialog defaultType={typeName} folderId={openFolder?.id ?? null} />
        )}
      </header>

      <section aria-labelledby="item-list-heading">
        {/* Keeps the outline h1 > h2 > h3 (card titles), like the dashboard. */}
        <h2 id="item-list-heading" className="sr-only">
          {plural}
        </h2>

        {isFilesPage ? (
          // Files get a Drive-style list with folders and filters instead of a
          // card grid. It has its own empty states, since folders can exist
          // without any files.
          <FileList items={items} folders={folders} folderId={openFolder?.id ?? null} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {plural.toLowerCase()} yet.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
