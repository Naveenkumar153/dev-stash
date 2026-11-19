/**
 * Writes to items: create, update, delete and the favorite / pin setters.
 * Every one is scoped to the owner passed in, so another user's row fails
 * like a missing one.
 */

import { Prisma } from "@/generated/prisma/client";
import { ITEM_DETAIL_SELECT, toItemDetail } from "@/lib/db/items";
import { tryDeleteOrphanedTags } from "@/lib/db/tags";
import type { CreateFileItemData, CreateItemData, UpdateItemData } from "@/lib/item-schemas";
import { getEditableItemFields, requiresUrl } from "@/lib/item-types";
import { prisma } from "@/lib/prisma";
import { getItemPreview } from "@/lib/search";
import type { ItemDetail } from "@/types/items";

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
 * `db` is a transaction client when the Free item limit is checked with it.
 */
export async function createItem(
  userId: string,
  data: CreateItemData,
  db: Prisma.TransactionClient = prisma,
): Promise<ItemDetail | null> {
  const itemType = await db.itemType.findFirst({
    where: { name: data.typeName, isSystem: true, userId: null },
    select: { id: true },
  });

  if (!itemType) {
    return null;
  }

  const fields = getEditableItemFields(data.typeName);
  const content = fields.content ? data.content : null;
  const url = fields.url ? data.url : null;

  const item = await db.item.create({
    data: {
      title: data.title,
      description: data.description,
      contentType: fields.url ? "url" : "text",
      content,
      language: fields.language ? data.language : null,
      url,
      preview: getItemPreview({ content, url, fileName: null }),
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
      preview: getItemPreview({ content: null, url: null, fileName: upload.fileName }),
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
    select: { itemType: { select: { name: true } }, tags: { select: { id: true } } },
  });

  if (!owned) {
    return { status: "not-found" };
  }

  if (requiresUrl(owned.itemType.name) && !data.url) {
    return { status: "url-required" };
  }

  const fields = getEditableItemFields(owned.itemType.name);
  // A file's preview is its name, which editing never changes.
  const preview =
    fields.content || fields.url
      ? getItemPreview({
          content: fields.content ? data.content : null,
          url: fields.url ? data.url : null,
          fileName: null,
        })
      : undefined;

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
        ...(preview !== undefined && { preview }),
        tags: { set: [], connectOrCreate: connectTags(data.tags) },
        collections: replaceCollections(data.collectionIds),
      },
      select: ITEM_DETAIL_SELECT,
    });

    // Tags the edit took off, if nothing else uses them now.
    await tryDeleteOrphanedTags(owned.tags.map((tag) => tag.id));

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
 * and its tag links go with it, along with any of its tags nothing else uses.
 */
export async function deleteItem(itemId: string, userId: string): Promise<DeletedItem | null> {
  try {
    const item = await prisma.item.delete({
      where: { id: itemId, userId },
      select: { fileUrl: true, tags: { select: { id: true } } },
    });
    await tryDeleteOrphanedTags(item.tags.map((tag) => tag.id));

    return { fileKey: item.fileUrl };
  } catch (error) {
    // No such item, or not this user's.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return null;
    }
    throw error;
  }
}
