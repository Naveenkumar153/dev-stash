"use client";

import { FolderPlus } from "lucide-react";
import { useState } from "react";

import { createFolder } from "@/actions/folders";
import { FolderNameDialog } from "@/components/items/FolderNameDialog";
import { Button } from "@/components/ui/button";
import { ROOT_FOLDER_LABEL } from "@/lib/folders";

interface NewFolderButtonProps {
  /** The open folder, which the new one goes in; null at the top level. */
  parentId: string | null;
  /** The open folder's name, for the dialog's description. */
  parentName: string | null;
}

/** The files page's New Folder button and the name dialog it opens. */
export function NewFolderButton({ parentId, parentName }: NewFolderButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* The text hides on phones, so the label carries the name. */}
      <Button size="lg" variant="outline" aria-label="New folder" onClick={() => setOpen(true)}>
        <FolderPlus aria-hidden />
        <span className="hidden sm:inline">New Folder</span>
      </Button>
      <FolderNameDialog
        open={open}
        onOpenChange={setOpen}
        title="New folder"
        description={`Creates a folder in “${parentName ?? ROOT_FOLDER_LABEL}”.`}
        submitLabel="Create"
        pendingLabel="Creating..."
        successMessage="Folder created"
        onSubmit={(name) => createFolder({ name, parentId })}
      />
    </>
  );
}
