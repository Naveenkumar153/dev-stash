import { Download } from "lucide-react";

import { FileTypeIcon } from "@/components/items/FileTypeIcon";
import { OpenItemButton } from "@/components/items/OpenItemButton";
import { Button } from "@/components/ui/button";
import type { ItemSummary } from "@/lib/db/items";
import { getFileCategory } from "@/lib/file-filters";
import { getItemFileUrl } from "@/lib/file-upload";
import { formatFileSize, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shared by the rows and the list's column header, so the columns line up. */
export const FILE_ROW_COLUMNS = "md:grid md:grid-cols-[minmax(0,1fr)_6rem_6rem] md:items-center md:gap-4";

/** The width the Download button takes, for the header and rows without a file. */
export const FILE_ROW_ACTION_SPACER = "size-7 shrink-0";

/**
 * A file item as a list row: icon, title over the file name, size, upload date
 * and a Download link. Clicking anywhere else on the row opens the item drawer
 * through the stretched title button; the link sits above that button's
 * ::after (relative z-10), so it downloads without opening the drawer. On
 * phones the size and date move under the name.
 */
export function FileRow({ item }: Readonly<{ item: ItemSummary }>) {
  const size = item.fileSize === null ? null : formatFileSize(item.fileSize);
  const date = (
    <time dateTime={item.createdAt.toISOString()}>{formatShortDate(item.createdAt)}</time>
  );

  return (
    <li className="relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 has-[[aria-haspopup=dialog]:focus-visible]:bg-accent/50 has-[[aria-haspopup=dialog]:focus-visible]:ring-3 has-[[aria-haspopup=dialog]:focus-visible]:ring-ring/50 has-[[aria-haspopup=dialog]:focus-visible]:ring-inset">
      <FileTypeIcon category={getFileCategory(item.fileName)} className="size-5" />

      <div className={cn("min-w-0 flex-1", FILE_ROW_COLUMNS)}>
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium">
            <OpenItemButton item={item}>{item.title}</OpenItemButton>
          </h3>
          {item.fileName && (
            <span className="truncate text-xs text-muted-foreground">{item.fileName}</span>
          )}
          <span className="text-xs text-muted-foreground md:hidden">
            {size && <>{size} · </>}
            {date}
          </span>
        </div>
        <span className="hidden text-sm text-muted-foreground md:block">{size ?? "—"}</span>
        <span className="hidden text-sm text-muted-foreground md:block">{date}</span>
      </div>

      {item.fileName ? (
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
      ) : (
        <span aria-hidden className={FILE_ROW_ACTION_SPACER} />
      )}
    </li>
  );
}
