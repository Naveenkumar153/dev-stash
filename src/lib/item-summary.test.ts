import { describe, expect, it } from "vitest";

import { toDrawerSummary } from "@/lib/item-summary";

describe("toDrawerSummary", () => {
  it("keeps only the fields the item drawer reads", () => {
    const card = {
      id: "item-1",
      title: "useAuth hook",
      typeName: "snippet",
      isPinned: true,
      isFavorite: false,
      description: "A long description the drawer loads itself",
      tags: ["react", "auth"],
      fileName: null,
      createdAt: new Date("2026-11-14T00:00:00.000Z"),
    };

    expect(toDrawerSummary(card)).toEqual({
      id: "item-1",
      title: "useAuth hook",
      typeName: "snippet",
      isPinned: true,
      isFavorite: false,
    });
  });
});
