import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { deleteFolderTree, moveFileItem, updateFolder } from "@/lib/db/folders";
import { prisma } from "@/lib/prisma";

const { tx } = vi.hoisted(() => ({
  tx: {
    folder: { findMany: vi.fn(), deleteMany: vi.fn() },
    item: { findMany: vi.fn(), deleteMany: vi.fn() },
    tag: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    folder: { update: vi.fn() },
    item: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/db/user", () => ({ getCurrentUserId: vi.fn() }));

const DOCS = "cmfolderdocs000000000001";
const ITEM_ID = "cmtg169y00002zzx5wxanksok";

/** Docs > 2026 > Q4, Docs > Drafts, and Config beside Docs. */
const LINKS = [
  { id: DOCS, parentId: null },
  { id: "year", parentId: DOCS },
  { id: "q4", parentId: "year" },
  { id: "drafts", parentId: DOCS },
  { id: "config", parentId: null },
];

function notFoundError() {
  return new Prisma.PrismaClientKnownRequestError("Record to update not found.", {
    code: "P2025",
    clientVersion: "7.10.0",
  });
}

describe("deleteFolderTree", () => {
  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation(((callback: (client: typeof tx) => unknown) =>
      callback(tx)) as never);
    tx.folder.findMany.mockResolvedValue(LINKS);
    tx.item.findMany.mockResolvedValue([
      { id: "item-1", fileUrl: "user-1/a-notes.md", tags: [{ id: "tag-docs" }] },
      { id: "item-2", fileUrl: "user-1/b-report.pdf", tags: [{ id: "tag-docs" }, { id: "tag-q4" }] },
      { id: "item-3", fileUrl: null, tags: [] },
    ]);
  });

  it("deletes the folder's subtree and the items it read, all scoped to the user", async () => {
    const result = await deleteFolderTree("user-1", DOCS);

    const subtree = [DOCS, "year", "drafts", "q4"];
    expect(tx.folder.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { id: true, parentId: true },
    });
    expect(tx.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", folderId: { in: subtree } },
      select: { id: true, fileUrl: true, tags: { select: { id: true } } },
    });
    expect(tx.item.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: ["item-1", "item-2", "item-3"] } },
    });
    expect(tx.folder.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", id: { in: subtree } },
    });
    expect(result).toEqual({
      folders: 3,
      files: 3,
      fileKeys: ["user-1/a-notes.md", "user-1/b-report.pdf"],
    });
  });

  it("removes the deleted files' tags nothing else uses, in the same transaction", async () => {
    await deleteFolderTree("user-1", DOCS);

    expect(tx.tag.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["tag-docs", "tag-q4"] }, items: { none: {} } },
    });
    expect(tx.item.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.tag.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it("deletes the items before the folders, so none falls back to the top level", async () => {
    await deleteFolderTree("user-1", DOCS);

    expect(tx.item.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.folder.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it("returns null and deletes nothing for a folder that isn't the user's", async () => {
    expect(await deleteFolderTree("user-1", "cmsomeoneelses0000000009")).toBeNull();
    expect(tx.item.findMany).not.toHaveBeenCalled();
    expect(tx.item.deleteMany).not.toHaveBeenCalled();
    expect(tx.folder.deleteMany).not.toHaveBeenCalled();
  });

  it("reports an empty folder with nothing beneath it", async () => {
    tx.item.findMany.mockResolvedValue([]);

    expect(await deleteFolderTree("user-1", "config")).toEqual({ folders: 0, files: 0, fileKeys: [] });
    expect(tx.folder.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", id: { in: ["config"] } } });
  });
});

describe("updateFolder", () => {
  it("writes only to the user's folder", async () => {
    const saved = { id: DOCS, name: "Documents", parentId: null };
    vi.mocked(prisma.folder.update).mockResolvedValue(saved as never);

    expect(await updateFolder("user-1", DOCS, { name: "Documents" })).toEqual(saved);
    expect(prisma.folder.update).toHaveBeenCalledWith({
      where: { id: DOCS, userId: "user-1" },
      data: { name: "Documents" },
      select: { id: true, name: true, parentId: true },
    });
  });

  it("returns null when the folder is gone or someone else's", async () => {
    vi.mocked(prisma.folder.update).mockRejectedValue(notFoundError());

    expect(await updateFolder("user-1", DOCS, { parentId: null })).toBeNull();
  });

  it("rethrows any other database error", async () => {
    vi.mocked(prisma.folder.update).mockRejectedValue(new Error("connection reset"));

    await expect(updateFolder("user-1", DOCS, { parentId: null })).rejects.toThrow("connection reset");
  });
});

describe("moveFileItem", () => {
  it("moves only the user's items of the system file type, not images", async () => {
    vi.mocked(prisma.item.updateMany).mockResolvedValue({ count: 1 });

    expect(await moveFileItem("user-1", ITEM_ID, DOCS)).toBe(true);
    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: "user-1", itemType: { name: "file", isSystem: true } },
      data: { folderId: DOCS },
    });
  });

  it("returns false when no such file matched", async () => {
    vi.mocked(prisma.item.updateMany).mockResolvedValue({ count: 0 });

    expect(await moveFileItem("user-1", ITEM_ID, null)).toBe(false);
  });
});
