"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteFolder } from "@/actions/folders";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCount } from "@/lib/format";
import { callAction } from "@/lib/action-call";
import { FOLDER_DELETE_FAILED } from "@/lib/action-result";

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
 * go with it. Nothing is deleted until the user confirms; a failure is toasted
 * and leaves the dialog open so they can retry or cancel.
 */
export function FolderDeleteDialog({ open, onOpenChange, folder, contents }: FolderDeleteDialogProps) {
  const [pending, startTransition] = useTransition();

  // Escape and the backdrop can't dismiss the dialog mid-delete.
  function handleOpenChange(next: boolean) {
    if (!pending) {
      onOpenChange(next);
    }
  }

  function handleDelete() {
    if (!folder) return;

    startTransition(async () => {
      const result = await callAction(() => deleteFolder(folder.id));
      if (!result) {
        return;
      }

      if (!result.success) {
        toast.error(result.error ?? FOLDER_DELETE_FAILED);
        return;
      }

      onOpenChange(false);
      // deleteFolder re-renders the list in its own response.
      toast.success("Folder deleted");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="wrap-break-word">
            Delete &ldquo;{folder?.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>{describeDeletion(contents)}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
