/** Items per page on /items/[type] and /collections/[id]. */
export const ITEMS_PER_PAGE = 21;
/** Collections per page on /collections. */
export const COLLECTIONS_PER_PAGE = 21;
/** Collection cards on the dashboard. */
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
/** Items in the dashboard's Recent list. */
export const DASHBOARD_RECENT_ITEMS_LIMIT = 10;

/** Pages shown on each side of the current one before an ellipsis. */
const SIBLING_COUNT = 1;

export type PageNumber = number | "ellipsis";

/** One page of a list, plus the total its controls and header count from. */
export interface Page<T> {
  rows: T[];
  total: number;
}

/**
 * The page a `?page=` parameter asks for: 1 when it's absent, the number when
 * it's a positive whole number written plainly ("2", not "02", "2.0" or
 * "+2"), and null for anything else, including a repeated parameter, so the
 * page can redirect to a URL that means what it shows.
 */
export function parsePageParam(param: string | string[] | undefined): number | null {
  if (param === undefined) {
    return 1;
  }
  if (typeof param !== "string" || !/^[1-9]\d*$/.test(param)) {
    return null;
  }

  const page = Number(param);

  return Number.isSafeInteger(page) ? page : null;
}

/** How many pages `total` rows fill; at least 1, so an empty list has page 1. */
export function getTotalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Rows to skip to reach `page` (1-based). */
export function getPageSkip(page: number, perPage: number): number {
  return (page - 1) * perPage;
}

/**
 * The page links to show: always the first and last page, the current one
 * and its neighbors, with "ellipsis" where pages are left out. An ellipsis
 * never stands in for a single page - that page is shown instead.
 */
export function getPageNumbers(current: number, totalPages: number): PageNumber[] {
  const start = Math.max(2, current - SIBLING_COUNT);
  const end = Math.min(totalPages - 1, current + SIBLING_COUNT);
  const pages: PageNumber[] = [1];

  if (start === 3) {
    pages.push(2);
  } else if (start > 3) {
    pages.push("ellipsis");
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end === totalPages - 2) {
    pages.push(totalPages - 1);
  } else if (end < totalPages - 2) {
    pages.push("ellipsis");
  }

  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

/** The URL of `page` of the list at `pathname`; page 1 has no parameter. */
export function getPageHref(pathname: string, page: number): string {
  return page === 1 ? pathname : `${pathname}?page=${page}`;
}
