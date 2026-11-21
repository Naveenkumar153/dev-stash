import type { LucideIcon } from "lucide-react";

import { getItemTypeLabel, getItemTypeStyleByName } from "@/lib/item-types";
import { cn } from "@/lib/utils";

const TILE_SIZES = {
  sm: { box: "size-7 rounded-md", icon: "size-4" },
  md: { box: "size-10 rounded-lg", icon: "size-5" },
  lg: { box: "size-12 rounded-lg", icon: "size-6" },
} as const;

interface IconTileProps {
  icon: LucideIcon;
  size?: keyof typeof TILE_SIZES;
  /** The tile's background, e.g. a type's tint or `bg-muted`. */
  className?: string;
  /** The icon's color. */
  iconClassName?: string;
  /** Names the icon for screen readers; without it the tile is decorative. */
  label?: string;
}

/** A rounded, tinted square holding one icon, for page headers, cards and lists. */
export function IconTile({
  icon: Icon,
  size = "md",
  className = "bg-muted",
  iconClassName = "text-muted-foreground",
  label,
}: Readonly<IconTileProps>) {
  const tile = TILE_SIZES[size];

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", tile.box, className)}
      aria-hidden={label ? undefined : true}
    >
      <Icon aria-label={label} className={cn(tile.icon, iconClassName)} />
    </span>
  );
}

interface ItemTypeIconTileProps {
  typeName: string;
  size?: keyof typeof TILE_SIZES;
  /** Names the tile by the type ("Snippet"), when nothing beside it says the type. */
  labelled?: boolean;
}

/** An item type's icon on its tint, in the type's color. */
export function ItemTypeIconTile({ typeName, size, labelled = false }: Readonly<ItemTypeIconTileProps>) {
  const { icon, colorClass, bgClass } = getItemTypeStyleByName(typeName);

  return (
    <IconTile
      icon={icon}
      size={size}
      className={bgClass}
      iconClassName={colorClass}
      label={labelled ? getItemTypeLabel(typeName) : undefined}
    />
  );
}
