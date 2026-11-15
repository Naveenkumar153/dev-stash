import { describe, expect, it } from "vitest";

import {
  DEFAULT_FAVORITE_SORT,
  FAVORITE_SORT_FIELDS,
  sortFavoriteCollections,
  sortFavoriteItems,
} from "@/lib/favorites-sort";
import { describeSortOrder, getNaturalSort } from "@/lib/sort";
import type { FavoriteCollection, FavoriteItem } from "@/types/favorites";

function item(id: string, title: string, typeName: string, day: number): FavoriteItem {
  return {
    id,
    title,
    typeName,
    isFavorite: true,
    isPinned: false,
    updatedAt: new Date(Date.UTC(2026, 10, day)),
  };
}

function collection(
  id: string,
  name: string,
  dominantTypeName: string | null,
  day: number,
): FavoriteCollection {
  return { id, name, itemCount: 1, dominantTypeName, updatedAt: new Date(Date.UTC(2026, 10, day)) };
}

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

const items = [
  item("a", "item 10", "link", 3),
  item("b", "Item 2", "snippet", 1),
  item("c", "alpha", "note", 4),
  item("d", "beta", "snippet", 2),
  item("e", "zeta", "custom", 5),
];

describe("sort fields", () => {
  it("starts on newest first", () => {
    expect(DEFAULT_FAVORITE_SORT).toEqual({ field: "date", direction: "desc" });
  });

  it("switches each field to its natural direction and names it", () => {
    expect(getNaturalSort(FAVORITE_SORT_FIELDS, "date")).toEqual(DEFAULT_FAVORITE_SORT);
    expect(getNaturalSort(FAVORITE_SORT_FIELDS, "name")).toEqual({ field: "name", direction: "asc" });
    expect(getNaturalSort(FAVORITE_SORT_FIELDS, "type")).toEqual({ field: "type", direction: "asc" });
    expect(describeSortOrder(FAVORITE_SORT_FIELDS, DEFAULT_FAVORITE_SORT)).toBe("Newest first");
    expect(describeSortOrder(FAVORITE_SORT_FIELDS, { field: "name", direction: "desc" })).toBe(
      "Z to A",
    );
  });
});

describe("sortFavoriteItems", () => {
  it("sorts by date, newest or oldest first", () => {
    expect(ids(sortFavoriteItems(items, DEFAULT_FAVORITE_SORT))).toEqual(["e", "c", "a", "d", "b"]);
    expect(ids(sortFavoriteItems(items, { field: "date", direction: "asc" }))).toEqual([
      "b",
      "d",
      "a",
      "c",
      "e",
    ]);
  });

  it("sorts names ignoring case and counting numbers", () => {
    expect(ids(sortFavoriteItems(items, { field: "name", direction: "asc" }))).toEqual([
      "c",
      "d",
      "b",
      "a",
      "e",
    ]);
    expect(ids(sortFavoriteItems(items, { field: "name", direction: "desc" }))).toEqual([
      "e",
      "a",
      "b",
      "d",
      "c",
    ]);
  });

  it("sorts by type order, custom types last, then by name", () => {
    expect(ids(sortFavoriteItems(items, { field: "type", direction: "asc" }))).toEqual([
      "d",
      "b",
      "c",
      "a",
      "e",
    ]);
    expect(ids(sortFavoriteItems(items, { field: "type", direction: "desc" }))).toEqual([
      "e",
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("breaks name ties on date then id, and leaves the input alone", () => {
    const ties = [item("y", "Same", "note", 1), item("x", "same", "note", 1), item("z", "same", "note", 2)];

    expect(ids(sortFavoriteItems(ties, { field: "name", direction: "asc" }))).toEqual(["x", "y", "z"]);
    expect(ids(ties)).toEqual(["y", "x", "z"]);
  });
});

describe("sortFavoriteCollections", () => {
  const collections = [
    collection("p", "React Patterns", "snippet", 2),
    collection("e", "Empty", null, 4),
    collection("w", "AI Workflows", "prompt", 1),
    collection("d", "DevOps", "snippet", 3),
  ];

  it("sorts by date and by name", () => {
    expect(ids(sortFavoriteCollections(collections, DEFAULT_FAVORITE_SORT))).toEqual([
      "e",
      "d",
      "p",
      "w",
    ]);
    expect(ids(sortFavoriteCollections(collections, { field: "name", direction: "asc" }))).toEqual([
      "w",
      "d",
      "e",
      "p",
    ]);
  });

  it("sorts by dominant type, with empty collections last either way", () => {
    expect(ids(sortFavoriteCollections(collections, { field: "type", direction: "asc" }))).toEqual([
      "d",
      "p",
      "w",
      "e",
    ]);
    expect(ids(sortFavoriteCollections(collections, { field: "type", direction: "desc" }))).toEqual([
      "w",
      "p",
      "d",
      "e",
    ]);
  });
});
