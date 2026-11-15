"use client";

import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

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
export function FilterSelect<T extends string>({
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
