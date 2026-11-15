"use client";

import { SortControl } from "@/components/sort/SortControl";
import { FILE_SORT_FIELDS, type FileSort } from "@/lib/file-filters";

interface FileSortControlProps {
  sort: FileSort;
  onChange: (sort: FileSort) => void;
}

/** The file list's Sort chip and order toggle over Uploaded, Name and Size. */
export function FileSortControl({ sort, onChange }: Readonly<FileSortControlProps>) {
  return <SortControl fields={FILE_SORT_FIELDS} sort={sort} onChange={onChange} />;
}
