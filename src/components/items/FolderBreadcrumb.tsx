import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ROOT_FOLDER_LABEL, getFolderHref } from "@/lib/folders";

interface FolderBreadcrumbProps {
  /** The open folder and its ancestors, top level first; empty at the top level. */
  path: readonly { id: string; name: string }[];
}

const LINK_CLASS =
  "block max-w-48 truncate rounded-sm text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** "Files > Parent > Child": every folder above the open one is a link; the open one is the current page. */
export function FolderBreadcrumb({ path }: Readonly<FolderBreadcrumbProps>) {
  const crumbs = [{ id: null, name: ROOT_FOLDER_LABEL }, ...path];

  return (
    <nav aria-label="Folder path">
      <ol className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;

          return (
            <li key={crumb.id ?? "root"} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              )}
              {isCurrent ? (
                <span aria-current="page" className="block max-w-48 truncate font-medium">
                  {crumb.name}
                </span>
              ) : (
                <Link href={getFolderHref(crumb.id)} className={LINK_CLASS}>
                  {crumb.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
