import { Folder, FolderInput, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { FILE_ROW_ACTIONS, FILE_ROW_COLUMNS } from "@/components/items/FileRow";
import { RowActionsMenu } from "@/components/items/RowActionsMenu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { getFolderHref, type FolderEntry } from "@/lib/folders";
import { formatCount, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** What a folder row's menu can do. */
export type FolderAction = "rename" | "move" | "delete";

interface FolderRowProps {
  folder: FolderEntry;
  /** How many sub-folders and files sit directly in it. */
  itemCount: number;
  onAction: (action: FolderAction) => void;
}

/**
 * A folder as a list row, above the files: icon, name, item count, created
 * date and an actions menu. The name is a link stretched over the row (its
 * ::after), so clicking anywhere on the row opens the folder, while the menu
 * sits above it (relative z-10). On phones the count and date move under the name.
 */
export function FolderRow({ folder, itemCount, onAction }: Readonly<FolderRowProps>) {
  const count = itemCount === 0 ? "Empty" : formatCount(itemCount, "item");
  const date = (
    <time dateTime={folder.createdAt.toISOString()}>{formatShortDate(folder.createdAt)}</time>
  );

  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 has-[[data-row-link]:focus-visible]:bg-accent/50 has-[[data-row-link]:focus-visible]:ring-3 has-[[data-row-link]:focus-visible]:ring-ring/50 has-[[data-row-link]:focus-visible]:ring-inset">
      <Folder aria-hidden className="size-5 shrink-0 fill-muted-foreground/30 text-muted-foreground" />

      <div className={cn("min-w-0 flex-1", FILE_ROW_COLUMNS)}>
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium">
            <Link
              href={getFolderHref(folder.id)}
              data-row-link
              className="outline-none after:absolute after:inset-0"
            >
              {folder.name}
            </Link>
          </h3>
          <span className="text-xs text-muted-foreground md:hidden">
            {count} · {date}
          </span>
        </div>
        <span className="hidden text-sm text-muted-foreground md:block">{count}</span>
        <span className="hidden text-sm text-muted-foreground md:block">{date}</span>
      </div>

      <div className={FILE_ROW_ACTIONS}>
        <RowActionsMenu label={`Actions for ${folder.name}`}>
          <DropdownMenuItem onClick={() => onAction("rename")}>
            <Pencil aria-hidden />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAction("move")}>
            <FolderInput aria-hidden />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onAction("delete")}>
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </RowActionsMenu>
      </div>
    </li>
  );
}
