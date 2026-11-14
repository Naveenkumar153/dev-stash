import type { FieldErrors } from "@/lib/auth-schemas";

/** A folder as the folder actions return it. */
export interface FolderRef {
  id: string;
  name: string;
  /** Null at the top level. */
  parentId: string | null;
}

/** Result of `createFolder`, `renameFolder` and `moveFolder`: the folder as saved, or why it wasn't. */
export interface FolderResult {
  success: boolean;
  data: FolderRef | null;
  error: string | null;
  /** The first validation message for each invalid field, e.g. a name clash under `name`. */
  fieldErrors: FieldErrors;
}

/** Result of `deleteFolder`: what was deleted with it, or why nothing was. */
export interface DeleteFolderResult {
  success: boolean;
  data: { id: string; folders: number; files: number } | null;
  error: string | null;
}

/** Result of `moveItem`: where the file went, or why it didn't move. */
export interface MoveItemResult {
  success: boolean;
  data: { id: string; folderId: string | null } | null;
  error: string | null;
}
