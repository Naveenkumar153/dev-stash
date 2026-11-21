import type { ContentType } from "@/generated/prisma/enums";
import type { FieldErrors } from "@/lib/action-result";

/**
 * What a card hands the item drawer when it opens: enough for the drawer's
 * header and action bar while the full detail loads.
 */
export interface ItemDrawerSummary {
  id: string;
  title: string;
  /** Item type name, e.g. "snippet" - drives the icon and colors. */
  typeName: string;
  isPinned: boolean;
  isFavorite: boolean;
}

/**
 * A file as the /items/files list shows it. Descriptions and tags are left out,
 * since the rows don't show them and the page sends every file at once.
 */
export interface FileListItem extends ItemDrawerSummary {
  /** Original name of the upload. */
  fileName: string | null;
  /** Size in bytes. */
  fileSize: number | null;
  /** The folder it sits in; null at the top level. */
  folderId: string | null;
  createdAt: Date;
}

/** A collection an item belongs to, as the item drawer lists it. */
export interface ItemCollectionRef {
  id: string;
  name: string;
}

/**
 * Everything the item drawer shows. Dates are ISO strings because the detail
 * reaches the browser as JSON from `GET /api/items/[id]`.
 */
export interface ItemDetail {
  id: string;
  title: string;
  description: string | null;
  contentType: ContentType;
  /** Text payload: snippets, prompts, notes and commands. */
  content: string | null;
  /** Link payload. */
  url: string | null;
  /** Syntax-highlight hint, e.g. "typescript". */
  language: string | null;
  /**
   * File payload: the uploaded file's original name and size in bytes. The
   * file itself is served by `GET /api/items/[id]/file`; where it's stored in
   * R2 never leaves the server.
   */
  fileName: string | null;
  fileSize: number | null;
  isPinned: boolean;
  isFavorite: boolean;
  /** Item type name, e.g. "snippet" - drives the icon and colors. */
  typeName: string;
  tags: string[];
  collections: ItemCollectionRef[];
  createdAt: string;
  updatedAt: string;
}

/** Body returned by `GET /api/items/[id]`. */
export interface ItemDetailResponse {
  success: boolean;
  data: ItemDetail | null;
  error: string | null;
}

/** Result of the `updateItem` server action: the saved item, or why it wasn't saved. */
export interface UpdateItemResult {
  success: boolean;
  data: ItemDetail | null;
  error: string | null;
  /** The first validation message for each invalid field, keyed by field name. */
  fieldErrors: FieldErrors;
}

/** Result of the `createItem` server action: the new item, or why it wasn't created. */
export type CreateItemResult = UpdateItemResult;

/** Body returned by `POST /api/items/upload`: the new file item, or why it wasn't created. */
export type UploadItemResponse = UpdateItemResult;

/** Result of the `deleteItem` server action: the deleted item's id, or why it wasn't deleted. */
export interface DeleteItemResult {
  success: boolean;
  data: { id: string } | null;
  error: string | null;
}

/** Result of `toggleItemPin()`: the saved state. */
export interface ToggleItemPinResult {
  success: boolean;
  data: { id: string; isPinned: boolean } | null;
  error: string | null;
}

/** Result of `setItemContent()`: what the drawer merges into the item it shows. */
export interface SetItemContentResult {
  success: boolean;
  data: { id: string; content: string; updatedAt: string } | null;
  error: string | null;
}
