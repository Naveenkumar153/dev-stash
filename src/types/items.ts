import type { ContentType } from "@/generated/prisma/enums";
import type { FieldErrors } from "@/lib/auth-schemas";

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
