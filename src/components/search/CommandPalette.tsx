"use client";

import { FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { formatCount } from "@/lib/format";
import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { searchPaletteData } from "@/lib/search-filter";
import { cn } from "@/lib/utils";
import type { SearchCollection, SearchData, SearchItem } from "@/types/search";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null until the first load finishes. */
  data: SearchData | null;
  /** Why the first load failed; null otherwise. */
  error: string | null;
  onSelectItem: (item: SearchItem) => void;
  onSelectCollection: (collection: SearchCollection) => void;
}

/**
 * The Cmd/Ctrl+K palette: one search box over the user's items and
 * collections, grouped, with arrow keys and Enter to pick. cmdk's own
 * filtering is off - `searchPaletteData()` ranks the results instead, so the
 * content preview can count without matching every short query fuzzily.
 */
export function CommandPalette({
  open,
  onOpenChange,
  ...results
}: Readonly<CommandPaletteProps>) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search your items and collections"
      className="sm:max-w-xl"
    >
      {/* Mounts with the popup, so every open starts with an empty search. */}
      <PaletteSearch {...results} />
    </CommandDialog>
  );
}

/** Whether the user has nothing at all to search, as opposed to no matches. */
function isEmptyAccount(data: SearchData | null): boolean {
  return data !== null && data.items.length === 0 && data.collections.length === 0;
}

function PaletteSearch({
  data,
  error,
  onSelectItem,
  onSelectCollection,
}: Readonly<Omit<CommandPaletteProps, "open" | "onOpenChange">>) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (data ? searchPaletteData(data, query) : null), [data, query]);

  return (
    // vimBindings off: cmdk would take Ctrl+K as "previous item", so on Windows
    // the shortcut couldn't close the palette it opened.
    <Command shouldFilter={false} vimBindings={false} loop>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search items and collections..."
        aria-label="Search items and collections"
      />
      <CommandList className="max-h-[min(24rem,60svh)]">
        {results ? (
          <>
            <CommandEmpty>
              {isEmptyAccount(data) ? "Nothing to search yet." : "No results found."}
            </CommandEmpty>

            {results.items.length > 0 && (
              <CommandGroup heading="Items">
                {results.items.map((item) => (
                  <ItemResult key={item.id} item={item} onSelect={onSelectItem} />
                ))}
              </CommandGroup>
            )}

            {results.collections.length > 0 && (
              <CommandGroup heading="Collections">
                {results.collections.map((collection) => (
                  <CollectionResult
                    key={collection.id}
                    collection={collection}
                    onSelect={onSelectCollection}
                  />
                ))}
              </CommandGroup>
            )}
          </>
        ) : (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">
            {error ?? "Loading..."}
          </p>
        )}
      </CommandList>
    </Command>
  );
}

function ItemResult({
  item,
  onSelect,
}: Readonly<{ item: SearchItem; onSelect: (item: SearchItem) => void }>) {
  const style = getItemTypeStyleByName(item.typeName);
  const Icon = style.icon;

  return (
    <CommandItem value={`item:${item.id}`} onSelect={() => onSelect(item)} className="gap-3">
      <span
        aria-hidden
        className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", style.bgClass)}
      >
        <Icon className={cn("size-4", style.colorClass)} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{item.title}</span>
        {item.preview && (
          <span className="truncate text-xs text-muted-foreground">{item.preview}</span>
        )}
      </span>
      <CommandShortcut className="tracking-normal">{getItemTypeLabel(item.typeName)}</CommandShortcut>
    </CommandItem>
  );
}

function CollectionResult({
  collection,
  onSelect,
}: Readonly<{
  collection: SearchCollection;
  onSelect: (collection: SearchCollection) => void;
}>) {
  const colorClass = collection.dominantTypeName
    ? getItemTypeStyleByName(collection.dominantTypeName).colorClass
    : "text-muted-foreground";

  return (
    <CommandItem
      value={`collection:${collection.id}`}
      onSelect={() => onSelect(collection)}
      className="gap-3"
    >
      <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <FolderOpen className={cn("size-4", colorClass)} />
      </span>
      <span className="min-w-0 flex-1 truncate">{collection.name}</span>
      <CommandShortcut className="tracking-normal">
        {formatCount(collection.itemCount, "item")}
      </CommandShortcut>
    </CommandItem>
  );
}
