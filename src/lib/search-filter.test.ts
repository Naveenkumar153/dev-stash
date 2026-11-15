import { describe, expect, it } from "vitest";

import {
  CONTENT_MATCH_SCORE,
  matchesEveryWord,
  scoreSearchCollection,
  scoreSearchItem,
  SEARCH_RESULT_LIMIT,
  searchPaletteData,
  TITLE_WORD_MATCH_SCORE,
} from "@/lib/search-filter";
import type { SearchCollection, SearchItem } from "@/types/search";

function item(id: string, title: string, typeName = "snippet", preview: string | null = null): SearchItem {
  return { id, title, typeName, isPinned: false, isFavorite: false, preview };
}

function collection(id: string, name: string): SearchCollection {
  return { id, name, itemCount: 0, dominantTypeName: null };
}

const ids = (entries: { id: string }[]) => entries.map((entry) => entry.id);

describe("matchesEveryWord", () => {
  it("matches when every word starts a word, in any order and case", () => {
    expect(matchesEveryWord("Run docker compose up -d", "UP dock")).toBe(true);
    expect(matchesEveryWord("vitest run --coverage", "cover")).toBe(true);
  });

  it("counts camelCase humps as word starts", () => {
    expect(matchesEveryWord("useDebounce hook", "debounce")).toBe(true);
    expect(matchesEveryWord("useLocalStorage", "local storage")).toBe(true);
  });

  it("doesn't match a word found only inside another word", () => {
    expect(matchesEveryWord("Show the latest release", "test")).toBe(false);
    expect(matchesEveryWord("Docker", "ocker")).toBe(false);
  });

  it("doesn't match when a word is missing, the text is null or the query is blank", () => {
    expect(matchesEveryWord("docker compose", "docker swarm")).toBe(false);
    expect(matchesEveryWord(null, "docker")).toBe(false);
    expect(matchesEveryWord("docker", "   ")).toBe(false);
  });
});

describe("scoreSearchItem", () => {
  it("matches the title fuzzily by word starts, ignoring case", () => {
    expect(scoreSearchItem(item("1", "Deploy with migrations"), "deploy mig")).toBeGreaterThan(0.5);
    expect(scoreSearchItem(item("1", "Docker multi-stage build"), "DMSB")).toBeGreaterThan(0.5);
  });

  it("matches the type label alongside the title", () => {
    expect(scoreSearchItem(item("1", "useDebounce hook", "snippet"), "hook snippet")).toBeGreaterThan(0);
  });

  it("ignores letters scattered through the title and type label", () => {
    // t-e in "Typed", s in "Snippet", t at its end: in order, but nowhere a word.
    expect(scoreSearchItem(item("1", "Typed context provider updated", "snippet"), "test")).toBe(0);
    expect(scoreSearchItem(item("1", "Refactoring assistant", "prompt"), "react")).toBe(0);
  });

  it("gives a title word inside camelCase the title word score", () => {
    expect(scoreSearchItem(item("1", "useDebounce hook"), "debounce")).toBe(TITLE_WORD_MATCH_SCORE);
  });

  it("gives a content-only match the flat content score", () => {
    const docker = item("1", "Start the stack", "command", "docker compose up -d");

    expect(scoreSearchItem(docker, "compose up")).toBe(CONTENT_MATCH_SCORE);
  });

  it("doesn't match content letter by letter or inside a word", () => {
    expect(scoreSearchItem(item("1", "Notes", "note", "a b c d e f"), "abc")).toBe(0);
    expect(scoreSearchItem(item("1", "Notes", "note", "the latest build"), "test")).toBe(0);
  });

  it("scores 0 when nothing matches", () => {
    expect(scoreSearchItem(item("1", "useDebounce hook", "snippet", "export"), "zzz")).toBe(0);
  });
});

describe("scoreSearchCollection", () => {
  it("matches the name fuzzily by word starts", () => {
    expect(scoreSearchCollection(collection("c", "React Patterns"), "rp")).toBeGreaterThan(0.5);
    expect(scoreSearchCollection(collection("c", "React Patterns"), "devops")).toBe(0);
  });

  it("matches a word inside camelCase, but not scattered letters", () => {
    expect(scoreSearchCollection(collection("c", "NextJs Patterns"), "js")).toBe(TITLE_WORD_MATCH_SCORE);
    expect(scoreSearchCollection(collection("c", "Terminal Commands"), "test")).toBe(0);
  });
});

describe("searchPaletteData", () => {
  const items = [
    item("1", "Refactoring assistant", "prompt"),
    item("2", "Context provider", "snippet", "import React from 'react'"),
    item("3", "React hooks", "note"),
    item("4", "Docker cleanup", "command", "docker system prune"),
  ];
  const collections = [collection("a", "DevOps"), collection("b", "React Patterns")];

  it("lists everything in the order loaded for a blank query", () => {
    const results = searchPaletteData({ items, collections }, "   ");

    expect(ids(results.items)).toEqual(["1", "2", "3", "4"]);
    expect(ids(results.collections)).toEqual(["a", "b"]);
  });

  it("ranks a title match above a content match and drops letter-by-letter titles", () => {
    const results = searchPaletteData({ items, collections }, "react");

    expect(ids(results.items)).toEqual(["3", "2"]);
    expect(ids(results.collections)).toEqual(["b"]);
  });

  it("trims the query and leaves out entries that don't match", () => {
    const results = searchPaletteData({ items, collections }, "  docker  ");

    expect(ids(results.items)).toEqual(["4"]);
    expect(results.collections).toEqual([]);
  });

  it("keeps the loaded order for equal scores", () => {
    const twins = [item("x", "Deploy script"), item("y", "Deploy script")];

    expect(ids(searchPaletteData({ items: twins, collections: [] }, "deploy").items)).toEqual(["x", "y"]);
  });

  it("caps each group at the result limit", () => {
    const many = Array.from({ length: SEARCH_RESULT_LIMIT + 5 }, (_, index) => item(String(index), `Hook ${index}`));
    const manyCollections = many.map(({ id, title }) => collection(id, title));

    const blank = searchPaletteData({ items: many, collections: manyCollections }, "");
    const typed = searchPaletteData({ items: many, collections: manyCollections }, "hook");

    expect(blank.items).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(blank.collections).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(typed.items).toHaveLength(SEARCH_RESULT_LIMIT);
    expect(typed.collections).toHaveLength(SEARCH_RESULT_LIMIT);
  });
});
