"use client";

import { renameFolder } from "@/actions/folders";
import { FolderDeleteDialog } from "@/components/items/FolderDeleteDialog";
import { FolderNameDialog } from "@/components/items/FolderNameDialog";
import { MoveToDialog, type MoveSubject } from "@/components/items/MoveToDialog";
import { countSubtree, type FolderEntry, type FolderFileCounts } from "@/lib/folders";

/** The dialog a row's menu opened. Kept after closing, so the dialog has content while it animates out. */
export type RowDialog =
  | { kind: "rename" | "delete"; folder: FolderEntry }
  | { kind: "move"; subject: MoveSubject };

interface FileRowDialogsProps {
  /** The dialog last opened, or null before any row's menu was used. */
  dialog: RowDialog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files directly in each folder, for the delete dialog's counts. */
  folderCounts: FolderFileCounts;
  /** Every folder, for the Move picker and the delete dialog's counts. */
  folders: FolderEntry[];
}

/** The Rename, Move to... and Delete dialogs the files list's row menus open. */
export function FileRowDialogs({
  dialog,
  open,
  onOpenChange,
  folderCounts,
  folders,
}: Readonly<FileRowDialogsProps>) {
  const rowFolder = dialog?.kind === "rename" || dialog?.kind === "delete" ? dialog.folder : null;

  return (
    <>
      {/* Keyed by folder, so the name field always starts from the folder it was opened for. */}
      <FolderNameDialog
        key={rowFolder?.id}
        open={open && dialog?.kind === "rename"}
        onOpenChange={onOpenChange}
        title="Rename folder"
        description={`Renames “${rowFolder?.name ?? ""}”.`}
        submitLabel="Rename"
        pendingLabel="Renaming..."
        successMessage="Folder renamed"
        initialName={rowFolder?.name}
        onSubmit={(name) => renameFolder({ folderId: rowFolder?.id ?? "", name })}
      />
      <MoveToDialog
        open={open && dialog?.kind === "move"}
        onOpenChange={onOpenChange}
        subject={dialog?.kind === "move" ? dialog.subject : null}
        folders={folders}
      />
      <FolderDeleteDialog
        open={open && dialog?.kind === "delete"}
        onOpenChange={onOpenChange}
        folder={rowFolder}
        contents={rowFolder ? countSubtree(folders, folderCounts, rowFolder.id) : { folders: 0, files: 0 }}
      />
    </>
  );
}
