import { describe, expect, it } from "vitest";

import {
  countDirectContents,
  countSubtree,
  formatFolderPath,
  getFolderHref,
  getFolderPath,
  getOpenFolderId,
  getSubtreeIds,
  groupByParent,
  hasNameClash,
  isSameFolderName,
  wouldCreateCycle,
  type FolderLink,
} from "@/lib/folders";

/*
 * Files            (top level)
 * ├── docs
 * │   ├── 2026
 * │   │   └── q4
 * │   └── drafts
 * └── config
 */
const TREE: (FolderLink & { name: string })[] = [
  { id: "docs", parentId: null, name: "Docs" },
  { id: "2026", parentId: "docs", name: "2026" },
  { id: "q4", parentId: "2026", name: "Q4" },
  { id: "drafts", parentId: "docs", name: "Drafts" },
  { id: "config", parentId: null, name: "Config" },
];

const BY_ID = new Map(TREE.map((folder) => [folder.id, folder]));

describe("getFolderHref", () => {
  it("opens the files page at the top level for null", () => {
    expect(getFolderHref(null)).toBe("/items/files");
  });

  it("puts the folder in the query string, encoded", () => {
    expect(getFolderHref("cmabc123")).toBe("/items/files?folder=cmabc123");
    expect(getFolderHref("a&b")).toBe("/items/files?folder=a%26b");
  });
});

describe("isSameFolderName", () => {
  it("ignores case", () => {
    expect(isSameFolderName("Docs", "dOCS")).toBe(true);
  });

  it("ignores Unicode composition, so a precomposed é matches e + combining accent", () => {
    expect(isSameFolderName("Café", "Café")).toBe(true);
  });

  it("tells different names apart", () => {
    expect(isSameFolderName("Docs", "Doc")).toBe(false);
  });
});

describe("hasNameClash", () => {
  const siblings = [
    { id: "a", name: "Docs" },
    { id: "b", name: "Config" },
  ];

  it("finds a sibling with the same name in any case", () => {
    expect(hasNameClash(siblings, "docs")).toBe(true);
  });

  it("allows a name no sibling has", () => {
    expect(hasNameClash(siblings, "Drafts")).toBe(false);
  });

  it("leaves out the folder itself, so a rename can change only the case", () => {
    expect(hasNameClash(siblings, "DOCS", "a")).toBe(false);
    expect(hasNameClash(siblings, "Config", "a")).toBe(true);
  });

  it("treats _ and % as plain characters, not wildcards", () => {
    expect(hasNameClash([{ id: "a", name: "my_docs" }], "my%docs")).toBe(false);
  });
});

describe("groupByParent", () => {
  it("lists each folder's direct children, with the top level under null", () => {
    const children = groupByParent(TREE);

    expect(children.get(null)?.map((folder) => folder.id)).toEqual(["docs", "config"]);
    expect(children.get("docs")?.map((folder) => folder.id)).toEqual(["2026", "drafts"]);
    expect(children.get("q4")).toBeUndefined();
  });
});

describe("getFolderPath", () => {
  it("returns the folders from the top level down to the folder", () => {
    expect(getFolderPath(BY_ID, "q4").map((folder) => folder.id)).toEqual(["docs", "2026", "q4"]);
  });

  it("is empty for the top level and for an unknown folder", () => {
    expect(getFolderPath(BY_ID, null)).toEqual([]);
    expect(getFolderPath(BY_ID, "missing")).toEqual([]);
  });

  it("stops at a parent that isn't in the tree", () => {
    const orphan = new Map([["x", { id: "x", parentId: "gone" }]]);

    expect(getFolderPath(orphan, "x").map((folder) => folder.id)).toEqual(["x"]);
  });

  it("stops on a corrupt tree that loops instead of running forever", () => {
    const loop = new Map([
      ["a", { id: "a", parentId: "b" }],
      ["b", { id: "b", parentId: "a" }],
    ]);

    expect(getFolderPath(loop, "a").map((folder) => folder.id)).toEqual(["b", "a"]);
  });
});

describe("formatFolderPath", () => {
  it("reads from Files down", () => {
    expect(formatFolderPath(getFolderPath(BY_ID, "q4"))).toBe("Files / Docs / 2026 / Q4");
  });

  it("is just Files at the top level", () => {
    expect(formatFolderPath([])).toBe("Files");
  });
});

describe("getSubtreeIds", () => {
  it("returns the folder and every folder beneath it, root first", () => {
    expect(getSubtreeIds(TREE, "docs")).toEqual(["docs", "2026", "drafts", "q4"]);
  });

  it("is only the folder itself when it has no sub-folders", () => {
    expect(getSubtreeIds(TREE, "config")).toEqual(["config"]);
  });

  it("visits each folder once on a corrupt tree that loops", () => {
    const loop = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ];

    expect(getSubtreeIds(loop, "a")).toEqual(["a", "b"]);
  });
});

describe("wouldCreateCycle", () => {
  it("refuses moving a folder into itself", () => {
    expect(wouldCreateCycle(TREE, "docs", "docs")).toBe(true);
  });

  it("refuses moving a folder into a descendant at any depth", () => {
    expect(wouldCreateCycle(TREE, "docs", "2026")).toBe(true);
    expect(wouldCreateCycle(TREE, "docs", "q4")).toBe(true);
  });

  it("allows moving a folder to the top level, a sibling or its parent's parent", () => {
    expect(wouldCreateCycle(TREE, "q4", null)).toBe(false);
    expect(wouldCreateCycle(TREE, "2026", "drafts")).toBe(false);
    expect(wouldCreateCycle(TREE, "q4", "docs")).toBe(false);
  });

  it("allows moving a folder into one of its ancestors' other branches", () => {
    expect(wouldCreateCycle(TREE, "docs", "config")).toBe(false);
  });
});

describe("countDirectContents", () => {
  it("counts each folder's direct sub-folders and files together", () => {
    const counts = countDirectContents(TREE, { docs: 2, q4: 1 });

    expect(counts.get("docs")).toBe(4);
    expect(counts.get("2026")).toBe(1);
    expect(counts.get("q4")).toBe(1);
    expect(counts.get("config")).toBeUndefined();
  });
});

describe("countSubtree", () => {
  const files = { docs: 1, q4: 2, config: 1 };

  it("counts the folders beneath it and the files anywhere inside", () => {
    expect(countSubtree(TREE, files, "docs")).toEqual({ folders: 3, files: 3 });
  });

  it("counts no folders for a folder without sub-folders", () => {
    expect(countSubtree(TREE, files, "config")).toEqual({ folders: 0, files: 1 });
  });

  it("counts nothing for an empty folder", () => {
    expect(countSubtree(TREE, files, "drafts")).toEqual({ folders: 0, files: 0 });
  });
});

describe("getOpenFolderId", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("reads the open folder on the files page", () => {
    expect(getOpenFolderId("/items/files", params("folder=folder-1"))).toBe("folder-1");
  });

  it("is null at the files page's top level, including an empty parameter", () => {
    expect(getOpenFolderId("/items/files", params(""))).toBeNull();
    expect(getOpenFolderId("/items/files", params("folder="))).toBeNull();
  });

  it("ignores the parameter on every other page", () => {
    expect(getOpenFolderId("/items/images", params("folder=folder-1"))).toBeNull();
    expect(getOpenFolderId("/dashboard", params("folder=folder-1"))).toBeNull();
    expect(getOpenFolderId("/items/files/extra", params("folder=folder-1"))).toBeNull();
  });
});
