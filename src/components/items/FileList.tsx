"use client";

import { useState, type ReactNode } from "react";

import { FILE_ROW_ACTION_SPACER, FILE_ROW_COLUMNS, FileRow } from "@/components/items/FileRow";
import { FileTypeIcon } from "@/components/items/FileTypeIcon";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemSummary } from "@/lib/db/items";
import {
  DEFAULT_FILE_FILTERS,
  FILE_DATE_FILTERS,
  FILE_TYPE_FILTERS,
  type FileFilters,
  type FileTypeFilter,
  isFileFilterActive,
  matchesFileFilters,
} from "@/lib/file-filters";
import { cn } from "@/lib/utils";

interface FilterState {
  filters: FileFilters;
  /** When the filters last changed; date ranges count back from here. */
  now: Date;
}

/**
 * The /items/files list: Type and Uploaded filters, like Google Drive's chips,
 * over a single-column list of file rows. Filtering runs over the items the
 * page already loaded, so it needs no request and resets on reload.
 */
export function FileList({ items }: Readonly<{ items: ItemSummary[] }>) {
  const [state, setState] = useState<FilterState | null>(null);
  const filters = state?.filters ?? DEFAULT_FILE_FILTERS;
  const active = isFileFilterActive(filters);
  const shown =
    state && active
      ? items.filter((item) => matchesFileFilters(item, filters, state.now))
      : items;

  function update(next: Partial<FileFilters>) {
    // The time is taken here, not during render, so rendering stays pure.
    setState({ filters: { ...filters, ...next }, now: new Date() });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="File type"
          placeholder="Type"
          options={FILE_TYPE_FILTERS}
          value={filters.type}
          defaultValue={DEFAULT_FILE_FILTERS.type}
          onChange={(type) => update({ type })}
          renderIcon={renderFileTypeIcon}
        />
        <FilterSelect
          label="Upload date"
          placeholder="Uploaded"
          options={FILE_DATE_FILTERS}
          value={filters.date}
          defaultValue={DEFAULT_FILE_FILTERS.date}
          onChange={(date) => update({ date })}
        />
        {active && (
          <>
            <Button variant="ghost" size="sm" onClick={() => setState(null)}>
              Clear filters
            </Button>
            <p role="status" className="ml-auto text-sm text-muted-foreground">
              {shown.length} of {items.length} files
            </p>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files match these filters.</p>
      ) : (
        <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div
            aria-hidden
            className="hidden items-center gap-3 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground md:flex"
          >
            <span className="size-5 shrink-0" />
            <div className={cn("min-w-0 flex-1", FILE_ROW_COLUMNS)}>
              <span>Name</span>
              <span>Size</span>
              <span>Uploaded</span>
            </div>
            <span className={FILE_ROW_ACTION_SPACER} />
          </div>
          <ul className="divide-y divide-border">
            {shown.map((item) => (
              <FileRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The type filter's option icon; "All types" gets the plain file icon. */
function renderFileTypeIcon(type: FileTypeFilter) {
  return <FileTypeIcon category={type === "all" ? null : type} className="size-4" />;
}

interface FilterSelectProps<T extends string> {
  /** Accessible name of the trigger. */
  label: string;
  /** Shown in the trigger while the filter is off, like Drive's chip names. */
  placeholder: string;
  options: readonly { value: T; label: string }[];
  value: T;
  defaultValue: T;
  onChange: (value: T) => void;
  /** An icon beside each option, and in the chip once a value is picked. */
  renderIcon?: (value: T) => ReactNode;
}

/** A filter chip: a compact select that reads its name until a value is picked. */
function FilterSelect<T extends string>({
  label,
  placeholder,
  options,
  value,
  defaultValue,
  onChange,
  renderIcon,
}: Readonly<FilterSelectProps<T>>) {
  const on = value !== defaultValue;

  return (
    <Select value={value} onValueChange={(next) => next && onChange(next)}>
      <SelectTrigger
        aria-label={label}
        className={cn("rounded-full", on && "border-primary/50 bg-primary/10")}
      >
        <SelectValue>
          {(selected: T) =>
            selected === defaultValue ? (
              placeholder
            ) : (
              <>
                {renderIcon?.(selected)}
                {options.find((option) => option.value === selected)?.label}
              </>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {renderIcon?.(option.value)}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
