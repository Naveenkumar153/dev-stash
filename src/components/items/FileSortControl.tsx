"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FILE_SORT_FIELDS,
  getDefaultSort,
  getSortOrderLabel,
  type FileSort,
  type FileSortField,
} from "@/lib/file-filters";

interface FileSortControlProps {
  sort: FileSort;
  onChange: (sort: FileSort) => void;
}

/**
 * The file list's Sort chip and order toggle. Picking a field switches to its
 * natural order (A to Z, largest first, newest first); the toggle flips it,
 * and names the order it's in, e.g. "Sort order: Newest first".
 */
export function FileSortControl({ sort, onChange }: Readonly<FileSortControlProps>) {
  const field = FILE_SORT_FIELDS.find((option) => option.value === sort.field)!;
  const order = getSortOrderLabel(sort);
  const DirectionIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-1">
      <Select
        value={sort.field}
        onValueChange={(next: FileSortField | null) => next && onChange(getDefaultSort(next))}
      >
        <SelectTrigger aria-label="Sort by" className="rounded-full">
          <SelectValue>
            {() => (
              <>
                <ArrowUpDown aria-hidden />
                {field.label}
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FILE_SORT_FIELDS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="rounded-full"
        aria-label={`Sort order: ${order}`}
        title={order}
        onClick={() =>
          onChange({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" })
        }
      >
        <DirectionIcon aria-hidden />
      </Button>
    </div>
  );
}
