import { connection } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { getAvailableTypes, getItemTypeBySlug } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";
import type { CreateFileItemData, CreateItemData, UpdateItemData } from "@/lib/item-schemas";
import {
  compareItemTypeOrder,
  getEditableItemFields,
  getItemTypeSlug,
  requiresUrl,
} from "@/lib/item-types";
import {
  DASHBOARD_RECENT_ITEMS_LIMIT,
  getPageSkip,
  ITEMS_PER_PAGE,
  type Page,
} from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getItemPreview } from "@/lib/search";
import type { FavoriteItem } from "@/types/favorites";
import type { FileListItem, ItemDetail, ItemDrawerSummary } from "@/types/items";
import type { SearchItem } from "@/types/search";

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
const NEWEST_FIRST = [{ createdAt: "desc" }, { id: "desc" }] as const;

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

/**
 * Sets whether one of `userId`'s items is a favorite, in one scoped statement.
 * Prisma bumps `updatedAt` with it, which is what /favorites sorts by. False
 * when there is no such item or it's someone else's.
 */
export async function setItemFavorite(
  userId: string,
  itemId: string,
  isFavorite: boolean,
): Promise<boolean> {
  try {
    await prisma.item.update({
      where: { id: itemId, userId },
      data: { isFavorite },
      select: { id: true },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return false;
    }
    throw error;
  }
}

/**
 * Sets whether one of `userId`'s items is pinned, in one scoped statement.
 * False when there is no such item or it's someone else's.
 */
export async function setItemPinned(
  userId: string,
  itemId: string,
  isPinned: boolean,
): Promise<boolean> {
  try {
    await prisma.item.update({
      where: { id: itemId, userId },
      data: { isPinned },
      select: { id: true },
    });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return false;
    }
    throw error;
  }
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

/**
 * Every file for /items/files, in every folder, newest first: the list
 * derives each folder's contents, counts and filtered views from it. Null when
 * the file type isn't in the database, so the route can 404.
 */
export async function getFileListItems(): Promise<FileItemList | null> {
  const scope = await getTypeListScope(getItemTypeSlug("file"));
  if (!scope) {
    return null;
  }

  const { userId, itemType } = scope;
  const rows = userId
    ? await prisma.item.findMany({
        where: { userId, itemTypeId: itemType.id },
        orderBy: [...NEWEST_FIRST],
        select: FILE_LIST_SELECT,
      })
    : [];

  return { typeName: itemType.name, items: rows.map((row) => ({ ...row, typeName: itemType.name })) };
}

/** A palette row's columns, plus the payloads its preview is cut from. */
const SEARCH_ITEM_SELECT = {
  id: true,
  title: true,
  isPinned: true,
  isFavorite: true,
  content: true,
  url: true,
  fileName: true,
  itemType: { select: { name: true } },
} as const;

/**
 * Every item of the current user's for the command palette, newest first, each
 * with a short preview in place of its payload. The full content is read and
 * cut down here, since Prisma can't select a substring without raw SQL, so
 * only the preview reaches the browser.
 *
 * Uncapped: the palette filters in the browser, so an item left out here could
 * never be found.
 */
export async function getSearchItems(): Promise<SearchItem[]> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const rows = await prisma.item.findMany({
    where: { userId },
    orderBy: [...NEWEST_FIRST],
    select: SEARCH_ITEM_SELECT,
  });

  return rows.map(({ itemType, content, url, fileName, ...item }) => ({
    ...item,
    typeName: itemType.name,
    preview: getItemPreview({ content, url, fileName }),
  }));
}

/** What the drawer shows on top of the card: the payload, collections and dates. */
const ITEM_DETAIL_SELECT = {
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

function toItemDetail({
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

/** Connects each tag by name, creating it first if no item uses it yet. */
function connectTags(names: string[]) {
  return names.map((name) => ({ where: { name }, create: { name } }));
}

/**
 * A new item's memberships, one join row per collection. The caller has
 * already checked the collections are the user's.
 */
function addToCollections(collectionIds: string[]) {
  return { create: collectionIds.map((collectionId) => ({ collectionId })) };
}

/**
 * Replaces an item's memberships with `collectionIds`: rows for collections
 * left out are deleted and rows for new ones added, while a collection the
 * item stays in keeps its row, and with it the date it was added.
 */
function replaceCollections(collectionIds: string[]) {
  return {
    deleteMany: { collectionId: { notIn: collectionIds } },
    createMany: {
      data: collectionIds.map((collectionId) => ({ collectionId })),
      skipDuplicates: true,
    },
  };
}

/**
 * Creates an item of a system type for `userId` and returns it as the drawer
 * shows it. Null when that system type isn't in the database. Only the
 * type-specific fields the type uses are written, so a crafted request can't
 * put a URL on a snippet; a link stores a `url` payload, every other type text.
 */
export async function createItem(
  userId: string,
  data: CreateItemData,
): Promise<ItemDetail | null> {
  const itemType = await prisma.itemType.findFirst({
    where: { name: data.typeName, isSystem: true, userId: null },
    select: { id: true },
  });

  if (!itemType) {
    return null;
  }

  const fields = getEditableItemFields(data.typeName);

  const item = await prisma.item.create({
    data: {
      title: data.title,
      description: data.description,
      contentType: fields.url ? "url" : "text",
      content: fields.content ? data.content : null,
      language: fields.language ? data.language : null,
      url: fields.url ? data.url : null,
      user: { connect: { id: userId } },
      itemType: { connect: { id: itemType.id } },
      tags: { connectOrCreate: connectTags(data.tags) },
      collections: addToCollections(data.collectionIds),
    },
    select: ITEM_DETAIL_SELECT,
  });

  return toItemDetail(item);
}

/** An upload already stored in R2, ready to attach to a new item. */
export interface StoredUpload {
  /** Where the file lives in R2. Saved in `Item.fileUrl`. */
  key: string;
  fileName: string;
  fileSize: number;
}

/**
 * Creates a file or image item for `userId` around a file already stored in
 * R2, inside `data.folderId` when set, and returns it as the drawer shows it.
 * Null when that system type isn't in the database, so the caller can remove
 * the stored file.
 */
export async function createFileItem(
  userId: string,
  data: CreateFileItemData,
  upload: StoredUpload,
): Promise<ItemDetail | null> {
  const itemType = await prisma.itemType.findFirst({
    where: { name: data.typeName, isSystem: true, userId: null },
    select: { id: true },
  });

  if (!itemType) {
    return null;
  }

  const item = await prisma.item.create({
    data: {
      title: data.title,
      description: data.description,
      contentType: "file",
      fileUrl: upload.key,
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      // The upload route has already checked the folder is this user's.
      ...(data.folderId && { folder: { connect: { id: data.folderId } } }),
      user: { connect: { id: userId } },
      itemType: { connect: { id: itemType.id } },
      tags: { connectOrCreate: connectTags(data.tags) },
      collections: addToCollections(data.collectionIds),
    },
    select: ITEM_DETAIL_SELECT,
  });

  return toItemDetail(item);
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

/** How saving the drawer's edits ended. */
export type UpdateItemOutcome =
  | { status: "saved"; item: ItemDetail }
  /** No such item, or it belongs to someone else. */
  | { status: "not-found" }
  /** The item's type needs a URL (a link) and the edit cleared it. */
  | { status: "url-required" };

/**
 * Saves the drawer's edits to one of `userId`'s items and returns it as the
 * drawer shows it. Only the type-specific fields the item's type edits are
 * written, and the tags are replaced: every current one is disconnected, then
 * each name is connected, created first if no item uses it yet. The
 * collections are replaced too; the caller has checked they're the user's. The edit
 * payload carries no type, so a link losing its URL is caught here, once the
 * stored type is known.
 */
export async function updateItem(
  itemId: string,
  userId: string,
  data: UpdateItemData,
): Promise<UpdateItemOutcome> {
  const owned = await prisma.item.findFirst({
    where: { id: itemId, userId },
    select: { itemType: { select: { name: true } } },
  });

  if (!owned) {
    return { status: "not-found" };
  }

  if (requiresUrl(owned.itemType.name) && !data.url) {
    return { status: "url-required" };
  }

  const fields = getEditableItemFields(owned.itemType.name);

  try {
    const item = await prisma.item.update({
      // Scoped to the owner again, so the write itself can't land elsewhere.
      where: { id: itemId, userId },
      data: {
        title: data.title,
        description: data.description,
        ...(fields.content && { content: data.content }),
        ...(fields.language && { language: data.language }),
        ...(fields.url && { url: data.url }),
        tags: { set: [], connectOrCreate: connectTags(data.tags) },
        collections: replaceCollections(data.collectionIds),
      },
      select: ITEM_DETAIL_SELECT,
    });

    return { status: "saved", item: toItemDetail(item) };
  } catch (error) {
    // Deleted between the lookup and the write.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return { status: "not-found" };
    }
    throw error;
  }
}

export interface DeletedItem {
  /** Where the item's file was stored in R2, for the caller to remove. Null for non-file items. */
  fileKey: string | null;
}

/**
 * Deletes one of `userId`'s items. Ownership and the delete are one statement,
 * so there's no window between checking and deleting. Null when there is no
 * such item or it belongs to someone else. Its collection memberships cascade
 * and its tag links go with it; the tags themselves stay.
 */
export async function deleteItem(itemId: string, userId: string): Promise<DeletedItem | null> {
  try {
    const item = await prisma.item.delete({
      where: { id: itemId, userId },
      select: { fileUrl: true },
    });

    return { fileKey: item.fileUrl };
  } catch (error) {
    // No such item, or not this user's.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
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
