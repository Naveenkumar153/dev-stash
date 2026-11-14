import { Download, Folder, FolderInput } from "lucide-react";
import Link from "next/link";

import { FileTypeIcon } from "@/components/items/FileTypeIcon";
import { OpenItemButton } from "@/components/items/OpenItemButton";
import { RowActionsMenu } from "@/components/items/RowActionsMenu";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { ItemSummary } from "@/lib/db/items";
import { getFileCategory } from "@/lib/file-filters";
import { getItemFileUrl } from "@/lib/file-upload";
import { formatFileSize, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shared by the rows and the list's column header, so the columns line up. */
export const FILE_ROW_COLUMNS = "md:grid md:grid-cols-[minmax(0,1fr)_6rem_6rem] md:items-center md:gap-4";

/**
 * The width of a row's action buttons: Download and the menu, two `icon-sm`
 * buttons with a gap. The header and folder rows reserve the same, so the
 * columns line up.
 */
export const FILE_ROW_ACTIONS = "flex w-15 shrink-0 items-center justify-end gap-1";

interface FileRowProps {
  item: ItemSummary;
  /**
   * Shown in place of the file name while a filter lists files from every
   * folder: where the file is ("Files / Docs"), linking to that folder.
   */
  folderPath?: { label: string; href: string };
  /** Opens the Move to... picker for this file. */
  onMove: () => void;
}

/**
 * A file item as a list row: icon, title over the file name, size, upload date,
 * a Download link and an actions menu. Clicking anywhere else on the row opens
 * the item drawer through the stretched title button; the link, the folder path
 * and the menu sit above that button's ::after (relative z-10), so they work
 * without opening the drawer. On phones the size and date move under the name.
 */
export function FileRow({ item, folderPath, onMove }: Readonly<FileRowProps>) {
  const size = item.fileSize === null ? null : formatFileSize(item.fileSize);
  const date = (
    <time dateTime={item.createdAt.toISOString()}>{formatShortDate(item.createdAt)}</time>
  );

  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 has-[[aria-haspopup=dialog]:focus-visible]:bg-accent/50 has-[[aria-haspopup=dialog]:focus-visible]:ring-3 has-[[aria-haspopup=dialog]:focus-visible]:ring-ring/50 has-[[aria-haspopup=dialog]:focus-visible]:ring-inset">
      <FileTypeIcon category={getFileCategory(item.fileName)} className="size-5" />

      <div className={cn("min-w-0 flex-1", FILE_ROW_COLUMNS)}>
        <div className="flex min-w-0 flex-col items-start">
          {/* While the path takes the file name's line, the name stays as the title's tooltip. */}
          <h3 className="max-w-full truncate text-sm font-medium" title={folderPath ? item.fileName ?? undefined : undefined}>
            <OpenItemButton item={item}>{item.title}</OpenItemButton>
          </h3>
          {folderPath ? (
            <Link
              href={folderPath.href}
              className="relative z-10 flex max-w-full items-center gap-1 rounded-sm text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Folder aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{folderPath.label}</span>
            </Link>
          ) : (
            item.fileName && (
              <span className="max-w-full truncate text-xs text-muted-foreground">{item.fileName}</span>
            )
          )}
          <span className="text-xs text-muted-foreground md:hidden">
            {size && <>{size} · </>}
            {date}
          </span>
        </div>
        <span className="hidden text-sm text-muted-foreground md:block">{size ?? "—"}</span>
        <span className="hidden text-sm text-muted-foreground md:block">{date}</span>
      </div>

      <div className={FILE_ROW_ACTIONS}>
        {item.fileName && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative z-10 shrink-0"
            render={<a href={getItemFileUrl(item.id, true)} download={item.fileName} />}
            nativeButton={false}
            aria-label={`Download ${item.fileName}`}
          >
            <Download aria-hidden />
          </Button>
        )}
        <RowActionsMenu label={`Actions for ${item.title}`}>
          <DropdownMenuItem onClick={onMove}>
            <FolderInput aria-hidden />
            Move to...
          </DropdownMenuItem>
        </RowActionsMenu>
      </div>
    </li>
  );
}
