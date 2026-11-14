"use client";

import { EllipsisVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RowActionsMenuProps {
  /** The trigger's accessible name, e.g. "Actions for Docs". */
  label: string;
  /** The menu's `DropdownMenuItem`s. */
  children: React.ReactNode;
}

/**
 * A file list row's "more actions" button and menu. The trigger sits above the
 * row's stretched link or button (relative z-10), so opening the menu doesn't
 * also open the row.
 */
export function RowActionsMenu({ label, children }: Readonly<RowActionsMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" className="relative z-10 shrink-0" aria-label={label} />}
      >
        <EllipsisVertical aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
