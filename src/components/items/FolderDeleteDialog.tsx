"use client";

import { deleteFolder } from "@/actions/folders";
import { ConfirmDeleteDialog } from "@/components/dialogs/ConfirmDeleteDialog";
import { FOLDER_DELETE_FAILED } from "@/lib/action-result";
import { formatCount } from "@/lib/format";

interface FolderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Kept while the dialog animates out, so it still has content. */
  folder: { id: string; name: string } | null;
  /** What's inside the folder at any depth, for the warning. */
  contents: { folders: number; files: number };
}

/** The warning: what goes with the folder ("the 2 folders and 5 files inside it"), or that it's empty. */
function describeDeletion({ folders, files }: FolderDeleteDialogProps["contents"]) {
  const parts = [
    folders > 0 && formatCount(folders, "folder"),
    files > 0 && formatCount(files, "file"),
  ].filter(Boolean);
  const contents =
    parts.length === 0
      ? "The folder is empty."
      : `This also deletes the ${parts.join(" and ")} inside it.`;

  return `${contents} It can't be undone.`;
}

/**
 * The confirmation for deleting a folder, stating how many folders and files
 * go with it.
 */
export function FolderDeleteDialog({ open, onOpenChange, folder, contents }: FolderDeleteDialogProps) {
  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      title={<>Delete &ldquo;{folder?.name}&rdquo;?</>}
      description={describeDeletion(contents)}
      // The dialog is only opened for a folder; null is the closing animation.
      onConfirm={() =>
        folder
          ? deleteFolder(folder.id)
          : Promise.resolve({ success: false, error: null })
      }
      failedMessage={FOLDER_DELETE_FAILED}
      // deleteFolder re-renders the list in its own response.
      successMessage="Folder deleted"
    />
  );
}
