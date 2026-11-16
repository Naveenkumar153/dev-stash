"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";

import { NewItemDialog } from "@/components/items/NewItemDialog";
import { Button } from "@/components/ui/button";
import { getItemTypeLabel, type CreatableItemType } from "@/lib/item-types";

interface NewItemButtonProps {
  /** The type the form starts on, which also names the button ("New Note"). */
  defaultType: CreatableItemType;
  /** The folder a new file goes in, null for the top level. */
  folderId?: string | null;
}

/** A list page's "New <Type>" button and the New Item dialog it opens. */
export function NewItemButton({ defaultType, folderId }: Readonly<NewItemButtonProps>) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button ref={buttonRef} size="lg" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        New {getItemTypeLabel(defaultType)}
      </Button>
      <NewItemDialog
        open={open}
        onOpenChange={setOpen}
        returnFocusRef={buttonRef}
        defaultType={defaultType}
        folderId={folderId}
      />
    </>
  );
}
