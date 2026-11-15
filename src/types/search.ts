import type { ItemDrawerSummary } from "@/types/items";

/**
 * An item as the command palette searches and lists it: what the item drawer
 * needs to open, plus a short preview of its payload to match against.
 */
export interface SearchItem extends ItemDrawerSummary {
  /** A short, single-line excerpt of the content, URL or file name; null if none. */
  preview: string | null;
}

/** A collection as the command palette searches and lists it. */
export interface SearchCollection {
  id: string;
  name: string;
  itemCount: number;
  /** Type the collection holds most of - tints its icon. Null if empty. */
  dominantTypeName: string | null;
}

export interface SearchData {
  items: SearchItem[];
  collections: SearchCollection[];
}

/** Body returned by `GET /api/search`. */
export interface SearchDataResponse {
  success: boolean;
  data: SearchData | null;
  error: string | null;
}
