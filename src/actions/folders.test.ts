import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFolder, deleteFolder, moveFolder, moveItem, renameFolder } from "@/actions/folders";
import { auth } from "@/auth";
import {
  deleteFolderTree,
  findFolder,
  getChildFolders,
  getFolderTree,
  insertFolder,
  moveFileItem,
  updateFolder,
} from "@/lib/db/folders";
import { discardStoredFiles } from "@/lib/stored-files";
import type { FolderRef } from "@/types/folders";

// The session, the queries and R2 cleanup are mocked; the Zod schemas and the
// tree helpers run for real, so these tests cover the checks end to end.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/folders", () => ({
  deleteFolderTree: vi.fn(),
  findFolder: vi.fn(),
  getChildFolders: vi.fn(),
  getFolderTree: vi.fn(),
  insertFolder: vi.fn(),
  moveFileItem: vi.fn(),
  updateFolder: vi.fn(),
}));
vi.mock("@/lib/stored-files", () => ({ discardStoredFiles: vi.fn() }));
// The entitlements run for real on the mocked session; nothing here counts rows.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

/** `auth` is overloaded (it doubles as middleware), so its mock is typed by hand. */
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;

const SESSION_EXPIRED = "Your session has expired. Sign in again.";
const FOLDER_NOT_FOUND = "This folder doesn't exist or has been deleted.";
const FILE_NOT_FOUND = "This file doesn't exist or has been deleted.";
const DESTINATION_NOT_FOUND = "The folder you picked doesn't exist or has been deleted.";

/*
 * Files
 * ├── Docs      (DOCS)
 * │   └── 2026  (YEAR)
 * │       └── Q4 (QUARTER)
 * └── Config    (CONFIG)
 */
const DOCS = "cmfolderdocs000000000001";
const YEAR = "cmfolderyear000000000002";
const QUARTER = "cmfolderq4000000000000003";
const CONFIG = "cmfolderconfig0000000004";
const ITEM_ID = "cmtg169y00002zzx5wxanksok";

const TREE: FolderRef[] = [
  { id: DOCS, name: "Docs", parentId: null },
  { id: YEAR, name: "2026", parentId: DOCS },
  { id: QUARTER, name: "Q4", parentId: YEAR },
  { id: CONFIG, name: "Config", parentId: null },
];

function signInAs(id: string) {
  mockAuth.mockResolvedValue({ user: { id, isPro: false }, expires: "2099-01-01T00:00:00.000Z" });
}

function nameTaken(name: string) {
  const message = `A folder named “${name}” already exists there.`;

  return { success: false, data: null, error: message, fieldErrors: { name: message } };
}

function failed(error: string) {
  return { success: false, data: null, error, fieldErrors: {} };
}

beforeEach(() => {
  signInAs("user-1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createFolder", () => {
  beforeEach(() => {
    vi.mocked(getChildFolders).mockResolvedValue([{ id: CONFIG, name: "Config" }]);
    vi.mocked(insertFolder).mockImplementation(async (_userId, name, parentId) => ({
      id: "cmnewfolder0000000000005",
      name,
      parentId,
    }));
  });

  it("refuses an account without Pro access while gating is on, writing nothing", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");

    expect(await createFolder({ name: "Docs", parentId: null })).toEqual({
      success: false,
      data: null,
      error: "File and image uploads are a Pro feature.",
      fieldErrors: {},
    });
    expect(insertFolder).not.toHaveBeenCalled();
  });

  it("lets a Pro account create one while gating is on", async () => {
    vi.stubEnv("PRO_GATING_ENABLED", "true");
    mockAuth.mockResolvedValue({ user: { id: "user-1", isPro: true }, expires: "2099-01-01T00:00:00.000Z" });

    expect(await createFolder({ name: "Docs", parentId: null })).toMatchObject({ success: true });
  });

  it("creates a trimmed folder at the top level", async () => {
    const result = await createFolder({ name: "  Docs  ", parentId: null });

    expect(result).toEqual({
      success: true,
      data: { id: "cmnewfolder0000000000005", name: "Docs", parentId: null },
      error: null,
      fieldErrors: {},
    });
    expect(getChildFolders).toHaveBeenCalledWith("user-1", null);
    expect(findFolder).not.toHaveBeenCalled();
    expect(insertFolder).toHaveBeenCalledWith("user-1", "Docs", null);
  });

  it("creates a folder inside one of the user's folders", async () => {
    vi.mocked(findFolder).mockResolvedValue(TREE[0]);

    const result = await createFolder({ name: "Drafts", parentId: DOCS });

    expect(result.success).toBe(true);
    expect(findFolder).toHaveBeenCalledWith("user-1", DOCS);
    expect(getChildFolders).toHaveBeenCalledWith("user-1", DOCS);
    expect(insertFolder).toHaveBeenCalledWith("user-1", "Drafts", DOCS);
  });

  it("refuses when signed out, before reading anything", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await createFolder({ name: "Docs", parentId: null })).toEqual(failed(SESSION_EXPIRED));
    expect(getChildFolders).not.toHaveBeenCalled();
  });

  it("returns a field error for a blank name", async () => {
    const result = await createFolder({ name: "   ", parentId: null });

    expect(result).toEqual({
      success: false,
      data: null,
      error: "Name is required",
      fieldErrors: { name: "Name is required" },
    });
    expect(insertFolder).not.toHaveBeenCalled();
  });

  it("refuses a name over 100 characters", async () => {
    const result = await createFolder({ name: "a".repeat(101), parentId: null });

    expect(result.fieldErrors).toEqual({ name: "Names can be up to 100 characters" });
    expect(insertFolder).not.toHaveBeenCalled();
  });

  it("treats a parent id that isn't a cuid as a missing folder, without a query", async () => {
    const result = await createFolder({ name: "Docs", parentId: "../etc" });

    expect(result.error).toBe(FOLDER_NOT_FOUND);
    expect(findFolder).not.toHaveBeenCalled();
  });

  it("refuses a parent that is missing or another user's", async () => {
    vi.mocked(findFolder).mockResolvedValue(null);

    expect(await createFolder({ name: "Docs", parentId: DOCS })).toEqual(failed(FOLDER_NOT_FOUND));
    expect(insertFolder).not.toHaveBeenCalled();
  });

  it("refuses a name a sibling already has, ignoring case", async () => {
    expect(await createFolder({ name: "config", parentId: null })).toEqual(nameTaken("config"));
    expect(insertFolder).not.toHaveBeenCalled();
  });

  it("returns a generic error when the database fails", async () => {
    vi.mocked(insertFolder).mockRejectedValue(new Error("connection reset"));

    expect(await createFolder({ name: "Docs", parentId: null })).toEqual(
      failed("Couldn't create this folder. Please try again."),
    );
    expect(console.error).toHaveBeenCalled();
  });
});

describe("renameFolder", () => {
  beforeEach(() => {
    vi.mocked(findFolder).mockResolvedValue(TREE[0]);
    vi.mocked(getChildFolders).mockResolvedValue([
      { id: DOCS, name: "Docs" },
      { id: CONFIG, name: "Config" },
    ]);
    vi.mocked(updateFolder).mockImplementation(async (_userId, id, data) => ({
      ...TREE[0],
      id,
      ...data,
    }));
  });

  it("renames the folder, checking names among its siblings", async () => {
    const result = await renameFolder({ folderId: DOCS, name: " Documents " });

    expect(result).toEqual({
      success: true,
      data: { id: DOCS, name: "Documents", parentId: null },
      error: null,
      fieldErrors: {},
    });
    expect(findFolder).toHaveBeenCalledWith("user-1", DOCS);
    expect(getChildFolders).toHaveBeenCalledWith("user-1", null);
    expect(updateFolder).toHaveBeenCalledWith("user-1", DOCS, { name: "Documents" });
  });

  it("allows changing only the case of the name", async () => {
    const result = await renameFolder({ folderId: DOCS, name: "DOCS" });

    expect(result.success).toBe(true);
    expect(updateFolder).toHaveBeenCalledWith("user-1", DOCS, { name: "DOCS" });
  });

  it("refuses when signed out", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await renameFolder({ folderId: DOCS, name: "Documents" })).toEqual(failed(SESSION_EXPIRED));
    expect(findFolder).not.toHaveBeenCalled();
  });

  it("returns a field error for a blank name", async () => {
    const result = await renameFolder({ folderId: DOCS, name: "" });

    expect(result.fieldErrors).toEqual({ name: "Name is required" });
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses a folder that is missing or another user's", async () => {
    vi.mocked(findFolder).mockResolvedValue(null);

    expect(await renameFolder({ folderId: DOCS, name: "Documents" })).toEqual(failed(FOLDER_NOT_FOUND));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses a name another sibling has", async () => {
    expect(await renameFolder({ folderId: DOCS, name: "CONFIG" })).toEqual(nameTaken("CONFIG"));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("reports a folder deleted between the lookup and the write as missing", async () => {
    vi.mocked(updateFolder).mockResolvedValue(null);

    expect(await renameFolder({ folderId: DOCS, name: "Documents" })).toEqual(failed(FOLDER_NOT_FOUND));
  });

  it("returns a generic error when the database fails", async () => {
    vi.mocked(findFolder).mockRejectedValue(new Error("connection reset"));

    expect(await renameFolder({ folderId: DOCS, name: "Documents" })).toEqual(
      failed("Couldn't rename this folder. Please try again."),
    );
  });
});

describe("moveFolder", () => {
  beforeEach(() => {
    vi.mocked(getFolderTree).mockResolvedValue(TREE);
    vi.mocked(updateFolder).mockImplementation(async (_userId, id, data) => ({
      ...TREE.find((folder) => folder.id === id)!,
      ...data,
    }));
  });

  it("moves a folder into another of the user's folders, reading the tree once", async () => {
    const result = await moveFolder({ folderId: YEAR, parentId: CONFIG });

    expect(result).toEqual({
      success: true,
      data: { id: YEAR, name: "2026", parentId: CONFIG },
      error: null,
      fieldErrors: {},
    });
    expect(getFolderTree).toHaveBeenCalledOnce();
    expect(getFolderTree).toHaveBeenCalledWith("user-1");
    expect(updateFolder).toHaveBeenCalledWith("user-1", YEAR, { parentId: CONFIG });
  });

  it("moves a folder to the top level", async () => {
    const result = await moveFolder({ folderId: QUARTER, parentId: null });

    expect(result.data).toEqual({ id: QUARTER, name: "Q4", parentId: null });
    expect(updateFolder).toHaveBeenCalledWith("user-1", QUARTER, { parentId: null });
  });

  it("succeeds without a write when the folder is already there", async () => {
    const result = await moveFolder({ folderId: YEAR, parentId: DOCS });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(TREE[1]);
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses when signed out", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await moveFolder({ folderId: YEAR, parentId: null })).toEqual(failed(SESSION_EXPIRED));
    expect(getFolderTree).not.toHaveBeenCalled();
  });

  it("treats a folder id that isn't a cuid as missing, without a query", async () => {
    expect(await moveFolder({ folderId: "nope", parentId: null })).toMatchObject({
      success: false,
      error: FOLDER_NOT_FOUND,
    });
    expect(getFolderTree).not.toHaveBeenCalled();
  });

  it("refuses a folder that isn't in the user's tree, e.g. another user's", async () => {
    const result = await moveFolder({ folderId: "cmsomeoneelses0000000009", parentId: null });

    expect(result).toEqual(failed(FOLDER_NOT_FOUND));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses a destination that isn't in the user's tree", async () => {
    const result = await moveFolder({ folderId: YEAR, parentId: "cmsomeoneelses0000000009" });

    expect(result).toEqual(failed(DESTINATION_NOT_FOUND));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses moving a folder into itself", async () => {
    const result = await moveFolder({ folderId: DOCS, parentId: DOCS });

    expect(result).toEqual(failed("A folder can't be moved into itself or one of its sub-folders."));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses moving a folder into one of its descendants", async () => {
    const result = await moveFolder({ folderId: DOCS, parentId: QUARTER });

    expect(result).toEqual(failed("A folder can't be moved into itself or one of its sub-folders."));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("refuses when the destination already holds a folder of the same name", async () => {
    vi.mocked(getFolderTree).mockResolvedValue([
      ...TREE,
      { id: "cmconfigdocs000000000006", name: "docs", parentId: CONFIG },
    ]);

    expect(await moveFolder({ folderId: DOCS, parentId: CONFIG })).toEqual(nameTaken("Docs"));
    expect(updateFolder).not.toHaveBeenCalled();
  });

  it("reports a folder deleted between the read and the write as missing", async () => {
    vi.mocked(updateFolder).mockResolvedValue(null);

    expect(await moveFolder({ folderId: YEAR, parentId: CONFIG })).toEqual(failed(FOLDER_NOT_FOUND));
  });

  it("returns a generic error when the database fails", async () => {
    vi.mocked(getFolderTree).mockRejectedValue(new Error("connection reset"));

    expect(await moveFolder({ folderId: YEAR, parentId: CONFIG })).toEqual(
      failed("Couldn't move this folder. Please try again."),
    );
  });
});

describe("deleteFolder", () => {
  const keys = ["user-1/a-notes.md", "user-1/b-report.pdf"];

  beforeEach(() => {
    vi.mocked(deleteFolderTree).mockResolvedValue({ folders: 2, files: 2, fileKeys: keys });
  });

  it("deletes the tree, then its stored files, and reports what went", async () => {
    const result = await deleteFolder(DOCS);

    expect(result).toEqual({ success: true, data: { id: DOCS, folders: 2, files: 2 }, error: null });
    expect(deleteFolderTree).toHaveBeenCalledWith("user-1", DOCS);
    expect(discardStoredFiles).toHaveBeenCalledWith(keys);
    expect(vi.mocked(deleteFolderTree).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(discardStoredFiles).mock.invocationCallOrder[0],
    );
  });

  it("refuses when signed out", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await deleteFolder(DOCS)).toEqual({ success: false, data: null, error: SESSION_EXPIRED });
    expect(deleteFolderTree).not.toHaveBeenCalled();
  });

  it("treats an id that isn't a cuid as missing, without a query", async () => {
    expect(await deleteFolder("not-a-cuid")).toEqual({ success: false, data: null, error: FOLDER_NOT_FOUND });
    expect(deleteFolderTree).not.toHaveBeenCalled();
  });

  it("refuses a folder that is missing or another user's, removing no files", async () => {
    vi.mocked(deleteFolderTree).mockResolvedValue(null);

    expect(await deleteFolder(DOCS)).toEqual({ success: false, data: null, error: FOLDER_NOT_FOUND });
    expect(discardStoredFiles).not.toHaveBeenCalled();
  });

  it("removes no files when the transaction fails", async () => {
    vi.mocked(deleteFolderTree).mockRejectedValue(new Error("connection reset"));

    expect(await deleteFolder(DOCS)).toEqual({
      success: false,
      data: null,
      error: "Couldn't delete this folder. Please try again.",
    });
    expect(discardStoredFiles).not.toHaveBeenCalled();
  });
});

describe("moveItem", () => {
  beforeEach(() => {
    vi.mocked(findFolder).mockResolvedValue(TREE[0]);
    vi.mocked(moveFileItem).mockResolvedValue(true);
  });

  it("moves a file into one of the user's folders", async () => {
    const result = await moveItem({ itemId: ITEM_ID, folderId: DOCS });

    expect(result).toEqual({ success: true, data: { id: ITEM_ID, folderId: DOCS }, error: null });
    expect(findFolder).toHaveBeenCalledWith("user-1", DOCS);
    expect(moveFileItem).toHaveBeenCalledWith("user-1", ITEM_ID, DOCS);
  });

  it("moves a file to the top level without looking up a folder", async () => {
    const result = await moveItem({ itemId: ITEM_ID, folderId: null });

    expect(result.data).toEqual({ id: ITEM_ID, folderId: null });
    expect(findFolder).not.toHaveBeenCalled();
    expect(moveFileItem).toHaveBeenCalledWith("user-1", ITEM_ID, null);
  });

  it("refuses when signed out", async () => {
    mockAuth.mockResolvedValue(null);

    expect(await moveItem({ itemId: ITEM_ID, folderId: null })).toEqual({
      success: false,
      data: null,
      error: SESSION_EXPIRED,
    });
    expect(moveFileItem).not.toHaveBeenCalled();
  });

  it("treats an item id that isn't a cuid as a missing file, without a query", async () => {
    expect((await moveItem({ itemId: "nope", folderId: null })).error).toBe(FILE_NOT_FOUND);
    expect(moveFileItem).not.toHaveBeenCalled();
  });

  it("refuses a destination that is missing or another user's", async () => {
    vi.mocked(findFolder).mockResolvedValue(null);

    expect((await moveItem({ itemId: ITEM_ID, folderId: DOCS })).error).toBe(DESTINATION_NOT_FOUND);
    expect(moveFileItem).not.toHaveBeenCalled();
  });

  it("refuses an item that isn't one of the user's files", async () => {
    vi.mocked(moveFileItem).mockResolvedValue(false);

    expect(await moveItem({ itemId: ITEM_ID, folderId: DOCS })).toEqual({
      success: false,
      data: null,
      error: FILE_NOT_FOUND,
    });
  });

  it("returns a generic error when the database fails", async () => {
    vi.mocked(moveFileItem).mockRejectedValue(new Error("connection reset"));

    expect((await moveItem({ itemId: ITEM_ID, folderId: DOCS })).error).toBe(
      "Couldn't move this file. Please try again.",
    );
  });
});
