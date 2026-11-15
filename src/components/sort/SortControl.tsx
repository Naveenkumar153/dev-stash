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
  describeSortOrder,
  getNaturalSort,
  type Sort,
  type SortFieldOption,
} from "@/lib/sort";

interface SortControlProps<F extends string> {
  fields: readonly SortFieldOption<F>[];
  sort: Sort<F>;
  onChange: (sort: Sort<F>) => void;
}

/**
 * A list's Sort chip and order toggle. Picking a field switches to its natural
 * order (A to Z, newest first); the toggle flips it, and names the order it's
 * in, e.g. "Sort order: Newest first".
 */
export function SortControl<F extends string>({
  fields,
  sort,
  onChange,
}: Readonly<SortControlProps<F>>) {
  const field = fields.find((option) => option.value === sort.field)!;
  const order = describeSortOrder(fields, sort);
  const DirectionIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="flex items-center gap-1">
      <Select
        value={sort.field}
        onValueChange={(next: F | null) => next && onChange(getNaturalSort(fields, next))}
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
          {fields.map((option) => (
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
