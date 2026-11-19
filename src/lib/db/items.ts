import { connection } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { getAvailableTypes, getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import {
  getDateFilterStart,
  getFilterExtensions,
  isFileFilterActive,
  type FileFilters,
} from "@/lib/file-filters";
import type { FolderFileCounts } from "@/lib/folders";
import { compareItemTypeOrder, getItemTypeSlug } from "@/lib/item-types";
import {
  DASHBOARD_RECENT_ITEMS_LIMIT,
  getPageSkip,
  ITEMS_PER_PAGE,
  type Page,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import type { FavoriteItem } from "@/types/favorites";
import type { FileListItem, ItemDetail, ItemDrawerSummary } from "@/types/items";

const PINNED_ITEM_LIMIT = 10;

export interface ItemSummary extends ItemDrawerSummary {
  description: string | null;
  tags: string[];
  /** Original name of a file or image item's upload; null for other types. */
  fileName: string | null;
  createdAt: Date;
}

/** Everything a card needs, and nothing else - payloads stay out of the list. */
const ITEM_CARD_SELECT = {
  id: true,
  title: true,
  description: true,
  isPinned: true,
  isFavorite: true,
  fileName: true,
  createdAt: true,
  itemType: { select: { name: true } },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
} as const;

/** A row of the files list: no description or tags, which the rows don't show. */
const FILE_LIST_SELECT = {
  id: true,
  title: true,
  isPinned: true,
  isFavorite: true,
  fileName: true,
  fileSize: true,
  folderId: true,
  createdAt: true,
} as const;

/** Newest first. createdAt ties break on id so the order is stable. */
export const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const;

/**
 * Most recently changed first. There's no favorited-at column, so updatedAt
 * stands in for when an item was favorited; ties break on id.
 */
const RECENTLY_UPDATED = [{ updatedAt: "desc" }, { id: "desc" }] as const;

interface ItemRow {
  id: string;
  title: string;
  description: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  fileName: string | null;
  createdAt: Date;
  itemType: { name: string };
  tags: { name: string }[];
}

function toSummary({ itemType, tags, ...item }: ItemRow): ItemSummary {
  return { ...item, typeName: itemType.name, tags: tags.map((tag) => tag.name) };
}

/**
 * Items the user pinned to the top, newest first. Bounded like every other list
 * query - pinning is unlimited, so without a cap the section grows with the
 * number of items the user has pinned.
 */
export async function getPinnedItems(
  limit = PINNED_ITEM_LIMIT,
): Promise<ItemSummary[]> {
  // Keeps the dashboard out of the build-time prerender, so the lists render
  // from the database at request time. See getRecentCollections.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { userId, isPinned: true },
    orderBy: [...NEWEST_FIRST],
    take: limit,
    select: ITEM_CARD_SELECT,
  });

  return items.map(toSummary);
}

/**
 * Every item the user favorited, most recently favorited (updated) first, for
 * /favorites. Uncapped: favorites are picked by hand, so the list stays short.
 */
export async function getFavoriteItems(): Promise<FavoriteItem[]> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { userId, isFavorite: true },
    orderBy: [...RECENTLY_UPDATED],
    select: {
      id: true,
      title: true,
      isPinned: true,
      isFavorite: true,
      updatedAt: true,
      itemType: { select: { name: true } },
    },
  });

  return items.map(({ itemType, ...item }) => ({ ...item, typeName: itemType.name }));
}

/** The latest items, newest first. */
export async function getRecentItems(
  limit = DASHBOARD_RECENT_ITEMS_LIMIT,
): Promise<ItemSummary[]> {
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: { userId },
    orderBy: [...NEWEST_FIRST],
    take: limit,
    select: ITEM_CARD_SELECT,
  });

  return items.map(toSummary);
}

export interface ItemTypeList {
  /** Item type name, e.g. "snippet" - drives the heading, icon and colors. */
  typeName: string;
  /** The requested page of the type's items. */
  items: ItemSummary[];
  /** Every item of the type, for the header count and the page links. */
  total: number;
}

export interface FileItemList {
  /** The file type's name, "file". */
  typeName: string;
  items: FileListItem[];
}

/**
 * The type whose list lives at `/items/${slug}` and whose items to list, or
 * null when no available type has that slug, so the route can 404. `userId` is
 * null when there is no current user, which lists nothing.
 */
async function getTypeListScope(slug: string) {
  // Keeps the list out of the build-time prerender.
  await connection();

  const [userId, itemType] = await Promise.all([getCurrentUserId(), getItemTypeBySlug(slug)]);

  return itemType ? { userId, itemType } : null;
}

/**
 * One page of the items matching `where`, pinned ones first and newest first
 * within each, as cards, with the count of every match. The page and the
 * count go out together.
 */
async function getItemPage(
  where: Prisma.ItemWhereInput,
  page: number,
): Promise<Page<ItemSummary>> {
  const [rows, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, ...NEWEST_FIRST],
      skip: getPageSkip(page, ITEMS_PER_PAGE),
      take: ITEMS_PER_PAGE,
      select: ITEM_CARD_SELECT,
    }),
    prisma.item.count({ where }),
  ]);

  return { rows: rows.map(toSummary), total };
}

/**
 * Page `page` (1-based) of the items of the type whose list lives at
 * `/items/${slug}`, newest first, plus how many there are in all. Null when
 * no available type has that slug, so the route can 404.
 */
export async function getItemsByType(
  slug: string,
  page: number,
): Promise<ItemTypeList | null> {
  const scope = await getTypeListScope(slug);
  if (!scope) {
    return null;
  }

  const { userId, itemType } = scope;
  const { rows, total } = userId
    ? await getItemPage({ userId, itemTypeId: itemType.id }, page)
    : { rows: [], total: 0 };

  return { typeName: itemType.name, items: rows, total };
}

/**
 * Page `page` (1-based) of the items in the collection at /collections/[id],
 * newest first, as cards, plus how many there are in all. Scoped to the
 * current user's items, so another user's collection id lists nothing.
 */
export async function getCollectionItems(
  collectionId: string,
  page: number,
): Promise<Page<ItemSummary>> {
  // Keeps the list out of the build-time prerender.
  await connection();

  const userId = await getCurrentUserId();

  if (!userId) {
    return { rows: [], total: 0 };
  }

  return getItemPage({ userId, collections: { some: { collectionId } } }, page);
}

/** What the files page shows: an open folder's files, or the matches of its filters. */
export interface FileListQuery {
  /** The open folder; null at the top level. Ignored while a filter is on. */
  folderId: string | null;
  filters: FileFilters;
  /** The request time; the Uploaded filter's ranges count back from it. */
  now: Date;
}

/** The files page's rows plus the counts that describe the rest. */
export interface FileListPage extends FileItemList {
  /** Every file the user has, for "N items" and "N of M files". */
  total: number;
  /** Files directly in each folder, for its row's count and its delete warning. */
  folderCounts: FolderFileCounts;
}

/**
 * The `where` for a filter: uploads from the range's start, and names ending
 * in one of the category's extensions. The extensions are fixed strings, so
 * `endsWith` has no wildcard to worry about.
 */
function getFileFilterWhere(filters: FileFilters, now: Date): Prisma.ItemWhereInput {
  const start = getDateFilterStart(filters.date, now);
  const extensions = getFilterExtensions(filters.type);

  return {
    ...(start && { createdAt: { gte: start } }),
    ...(extensions.length > 0 && {
      OR: extensions.map((extension) => ({
        fileName: { endsWith: `.${extension}`, mode: "insensitive" as const },
      })),
    }),
  };
}

/**
 * The rows /items/files shows, newest first: the open folder's files, or with
 * a Type or Uploaded filter on, the matching files in every folder - never
 * every file the user has. Alongside, one grouped count gives each folder's
 * file count and the total. Null when the file type isn't in the database, so
 * the route can 404.
 */
export async function getFileListPage({
  folderId,
  filters,
  now,
}: FileListQuery): Promise<FileListPage | null> {
  const scope = await getTypeListScope(getItemTypeSlug("file"));
  if (!scope) {
    return null;
  }

  const { userId, itemType } = scope;
  if (!userId) {
    return { typeName: itemType.name, items: [], total: 0, folderCounts: {} };
  }

  const owned = { userId, itemTypeId: itemType.id };
  const [rows, groups] = await Promise.all([
    prisma.item.findMany({
      where: isFileFilterActive(filters)
        ? { ...owned, ...getFileFilterWhere(filters, now) }
        : { ...owned, folderId },
      orderBy: [...NEWEST_FIRST],
      select: FILE_LIST_SELECT,
    }),
    prisma.item.groupBy({ by: ["folderId"], where: owned, _count: { _all: true } }),
  ]);

  const folderCounts: Record<string, number> = {};
  let total = 0;
  for (const group of groups) {
    total += group._count._all;
    if (group.folderId !== null) {
      folderCounts[group.folderId] = group._count._all;
    }
  }

  return {
    typeName: itemType.name,
    items: rows.map((row) => ({ ...row, typeName: itemType.name })),
    total,
    folderCounts,
  };
}

/** What the drawer shows on top of the card: the payload, collections and dates. */
export const ITEM_DETAIL_SELECT = {
  id: true,
  title: true,
  description: true,
  contentType: true,
  content: true,
  url: true,
  language: true,
  fileName: true,
  fileSize: true,
  isPinned: true,
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
  itemType: { select: { name: true } },
  tags: { select: { name: true }, orderBy: { name: "asc" } },
  collections: {
    select: { collection: { select: { id: true, name: true } } },
    orderBy: { collection: { name: "asc" } },
  },
} as const;

/**
 * One item with everything the item drawer shows, for `GET /api/items/[id]`.
 * Null when there is no such item or it belongs to someone else - the caller
 * can't tell the two apart, so an id can't be used to probe other users' items.
 */
export async function getItemDetail(id: string): Promise<ItemDetail | null> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: ITEM_DETAIL_SELECT,
  });

  return item ? toItemDetail(item) : null;
}

type ItemDetailRow = Prisma.ItemGetPayload<{ select: typeof ITEM_DETAIL_SELECT }>;

export function toItemDetail({
  itemType,
  tags,
  collections,
  createdAt,
  updatedAt,
  ...rest
}: ItemDetailRow): ItemDetail {
  return {
    ...rest,
    typeName: itemType.name,
    tags: tags.map((tag) => tag.name),
    collections: collections.map(({ collection }) => collection),
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** Total bytes of the files `userId` has stored, for the upload quota. */
export async function getStoredBytes(userId: string): Promise<number> {
  const { _sum } = await prisma.item.aggregate({
    where: { userId, fileSize: { not: null } },
    _sum: { fileSize: true },
  });
  return _sum.fileSize ?? 0;
}

export interface ItemFile {
  /** Where the file lives in R2. */
  key: string;
  fileName: string;
}

/**
 * Where one item's file is stored, for the download proxy. Scoped like
 * `getItemDetail`, so the drawer can download exactly the items it can open,
 * and null for another user's item, a missing one, or one without a file.
 */
export async function getItemFile(id: string): Promise<ItemFile | null> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  const item = await prisma.item.findFirst({
    where: { id, userId, contentType: "file" },
    select: { fileUrl: true, fileName: true },
  });

  if (!item?.fileUrl || !item.fileName) {
    return null;
  }

  return { key: item.fileUrl, fileName: item.fileName };
}

export interface ItemTypeCount {
  id: string;
  /** Item type name, e.g. "snippet" - drives the icon, colors and route. */
  name: string;
  /** How many of the user's items carry this type. */
  count: number;
}

/**
 * Every type the user can file an item under - the system types plus their own
 * custom ones - with their item counts, for the sidebar.
 */
export async function getItemTypeCounts(): Promise<ItemTypeCount[]> {
  // See getRecentCollections: keeps the sidebar out of the prerender.
  await connection();

  return countItemsByType(await getCurrentUserId());
}

/**
 * Item counts per available type for `userId`. Two queries rather than one
 * count per type, joined in memory.
 */
export async function countItemsByType(userId: string | null): Promise<ItemTypeCount[]> {
  const [types, counts] = await Promise.all([
    getAvailableTypes(userId),
    userId
      ? prisma.item.groupBy({
          by: ["itemTypeId"],
          where: { userId },
          _count: { _all: true },
        })
      : [],
  ]);

  const countByTypeId = new Map(
    counts.map((row) => [row.itemTypeId, row._count._all]),
  );

  // An unseeded database still lists the types, all at zero.
  return types
    .map((type) => ({ ...type, count: countByTypeId.get(type.id) ?? 0 }))
    .sort((a, b) => compareItemTypeOrder(a.name, b.name));
}
