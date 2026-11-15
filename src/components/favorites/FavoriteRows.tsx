import { FolderOpen } from "lucide-react";
import Link from "next/link";

import { OpenItemButton } from "@/components/items/OpenItemButton";
import { formatCount, formatShortDate } from "@/lib/format";
import { toDrawerSummary } from "@/lib/item-summary";
import { getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";
import type { FavoriteCollection, FavoriteItem } from "@/types/favorites";

/**
 * One dense, terminal-style line. The title control's ::after stretches over
 * it (relative), so the whole row is the click target, and the inset ring
 * shows while that control has keyboard focus.
 */
const ROW =
  "relative flex h-8 items-center gap-3 px-2 transition-colors hover:bg-muted/50 has-focus-visible:bg-muted/50 has-focus-visible:ring-2 has-focus-visible:ring-ring/50 has-focus-visible:ring-inset";

const TITLE = "min-w-0 flex-1 truncate text-left outline-none after:absolute after:inset-0";

/** A small chip outlined in its type's color; `borderClass` sets which. */
const BADGE = "shrink-0 rounded-sm border px-1.5 text-[11px] leading-4 text-muted-foreground";

function RowDate({ date }: Readonly<{ date: Date }>) {
  return (
    <time
      dateTime={date.toISOString()}
      className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums"
    >
      {formatShortDate(date)}
    </time>
  );
}

/** A favorited item: type icon, title, type badge and date. Opens the item drawer. */
export function FavoriteItemRow({ item }: Readonly<{ item: FavoriteItem }>) {
  const { icon: Icon, colorClass, chipBorderClass } = getItemTypeStyleByName(item.typeName);

  return (
    <li className={ROW}>
      <Icon aria-hidden className={cn("size-4 shrink-0", colorClass)} />
      <OpenItemButton item={toDrawerSummary(item)} className={TITLE}>
        {item.title}
      </OpenItemButton>
      <span className={cn(BADGE, chipBorderClass)}>{item.typeName}</span>
      <RowDate date={item.updatedAt} />
    </li>
  );
}

/**
 * A favorited collection: a folder tinted by the type it holds most of, the
 * name, a "collection" badge, its size and date. Links to its page.
 */
export function FavoriteCollectionRow({ collection }: Readonly<{ collection: FavoriteCollection }>) {
  // The type the collection holds most of colors its icon and chip; an empty
  // collection falls back to the neutral style.
  const { colorClass, chipBorderClass } = getItemTypeStyleByName(
    collection.dominantTypeName ?? "",
  );

  return (
    <li className={ROW}>
      <FolderOpen aria-hidden className={cn("size-4 shrink-0", colorClass)} />
      <Link href={`/collections/${collection.id}`} className={TITLE}>
        {collection.name}
      </Link>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {formatCount(collection.itemCount, "item")}
      </span>
      <span className={cn(BADGE, chipBorderClass)}>collection</span>
      <RowDate date={collection.updatedAt} />
    </li>
  );
}

interface FavoritesSectionProps {
  id: string;
  title: string;
  count: number;
  /** Shown in place of the list when this section has nothing. */
  emptyMessage: string;
  children: React.ReactNode;
}

/** A labelled list with its count, like a file explorer's group header. */
export function FavoritesSection({
  id,
  title,
  count,
  emptyMessage,
  children,
}: Readonly<FavoritesSectionProps>) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="flex items-center gap-2 border-b border-border px-2 pb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase"
      >
        {/* The space keeps the heading's text "Items 6", not "Items6"; flex hides it. */}
        {title}{" "}
        <span className="tabular-nums">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-border/50">{children}</ul>
      )}
    </section>
  );
}
