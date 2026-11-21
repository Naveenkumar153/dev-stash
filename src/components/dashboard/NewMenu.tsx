"use client";

import { ChevronDown, FilePlus, FolderPlus, Plus } from "lucide-react";
import { useRef, useState } from "react";

import { CollectionFormDialog } from "@/components/collections/CollectionFormDialog";
import { NewItemDialog } from "@/components/items/NewItemDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NewDialog = "item" | "collection";

/**
 * The top bar's one primary action: "+ New" opens a menu of what to create,
 * and each choice opens its dialog. The dialogs sit outside the menu so they
 * survive it closing, and return focus to the trigger when they close. The
 * item dialog starts on the current list page's type and uploads files into
 * the open folder, as the separate New Item button did.
 */
export function NewMenu() {
  const [openDialog, setOpenDialog] = useState<NewDialog | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setDialogOpen = (dialog: NewDialog) => (open: boolean) =>
    setOpenDialog(open ? dialog : null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button ref={triggerRef} size="lg" />}>
          <Plus aria-hidden />
          New
          <ChevronDown aria-hidden className="-mr-0.5 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setOpenDialog("item")}>
            <FilePlus aria-hidden />
            Item
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenDialog("collection")}>
            <FolderPlus aria-hidden />
            Collection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewItemDialog
        open={openDialog === "item"}
        onOpenChange={setDialogOpen("item")}
        returnFocusRef={triggerRef}
      />
      <CollectionFormDialog
        open={openDialog === "collection"}
        onOpenChange={setDialogOpen("collection")}
        returnFocusRef={triggerRef}
      />
    </>
  );
}
