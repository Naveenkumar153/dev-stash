import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPageHref, getPageNumbers } from "@/lib/pagination";
import { cn } from "@/lib/utils";

interface ListPaginationProps {
  /** The list's path without a query, e.g. "/items/snippets". */
  pathname: string;
  /** The page on screen, 1-based and within range. */
  page: number;
  totalPages: number;
  /** Names the navigation landmark, e.g. "Snippets pages". */
  label: string;
}

interface DisabledStepProps {
  direction: "previous" | "next";
}

/**
 * Previous or Next when there is no page that way: the link's look, greyed
 * out, with no href, so it can't be clicked or reached with Tab.
 */
function DisabledStep({ direction }: DisabledStepProps) {
  const isPrevious = direction === "previous";

  return (
    <span
      role="link"
      aria-disabled="true"
      aria-label={isPrevious ? "Go to previous page" : "Go to next page"}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "pointer-events-none opacity-50",
        isPrevious ? "pl-1.5!" : "pr-1.5!",
      )}
    >
      {isPrevious && <ChevronLeftIcon aria-hidden data-icon="inline-start" />}
      <span className="hidden sm:block">{isPrevious ? "Previous" : "Next"}</span>
      {!isPrevious && <ChevronRightIcon aria-hidden data-icon="inline-end" />}
    </span>
  );
}

/**
 * Numbered page links with Previous / Next for a paged list, in the same place
 * on every page: left-aligned and stuck to the bottom of the scroll area while
 * the list runs past it. `mt-auto` takes it to the bottom on a short list too,
 * as long as the page column fills the height (`min-h-full`, then `flex-1`
 * down to this component's parent). Renders nothing when everything fits on
 * one page.
 */
export function ListPagination({ pathname, page, totalPages, label }: ListPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <Pagination
      aria-label={label}
      // z-20 keeps the cards' z-10 controls (copy, menus) underneath it. The
      // sticky edge sits inside <main>'s bottom padding, so the bar is the
      // same distance from the bottom whether stuck or at the end of the list.
      className="sticky bottom-0 z-20 mx-0 mt-auto justify-start border-t bg-background py-3"
    >
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={getPageHref(pathname, page - 1)} />
          ) : (
            <DisabledStep direction="previous" />
          )}
        </PaginationItem>

        {getPageNumbers(page, totalPages).map((entry, index) => (
          <PaginationItem key={entry === "ellipsis" ? `ellipsis-${index}` : entry}>
            {entry === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href={getPageHref(pathname, entry)}
                isActive={entry === page}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationNext href={getPageHref(pathname, page + 1)} />
          ) : (
            <DisabledStep direction="next" />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
