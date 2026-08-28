import {
  Code,
  File,
  Image,
  Link,
  Sparkles,
  StickyNote,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { items, itemTypes } from "@/lib/mock-data";

export interface ItemTypeStyle {
  icon: LucideIcon;
  /** Tailwind text color class for the type. */
  colorClass: string;
  /** Tailwind left border color class, used on color-coded cards. */
  borderClass: string;
  /** Tailwind tinted background class, used behind a type icon. */
  bgClass: string;
}

export interface ItemTypeNavEntry extends ItemTypeStyle {
  id: string;
  /** Plural label shown in the sidebar, e.g. "Snippets". */
  label: string;
  /** Route for the type's item list, e.g. "/items/snippets". */
  href: string;
  count: number;
}

/** Maps the `icon` name stored on an item type to its lucide component. */
const TYPE_ICONS: Record<string, LucideIcon> = {
  Code,
  Sparkles,
  Terminal,
  StickyNote,
  File,
  Image,
  Link,
};

/**
 * Type colors live as tokens in globals.css. They are spelled out here rather
 * than built from the type id so Tailwind can see every class name.
 */
const TYPE_COLOR_CLASSES: Record<string, Omit<ItemTypeStyle, "icon">> = {
  "type-snippet": {
    colorClass: "text-type-snippet",
    borderClass: "border-l-type-snippet",
    bgClass: "bg-type-snippet/10",
  },
  "type-prompt": {
    colorClass: "text-type-prompt",
    borderClass: "border-l-type-prompt",
    bgClass: "bg-type-prompt/10",
  },
  "type-command": {
    colorClass: "text-type-command",
    borderClass: "border-l-type-command",
    bgClass: "bg-type-command/10",
  },
  "type-note": {
    colorClass: "text-type-note",
    borderClass: "border-l-type-note",
    bgClass: "bg-type-note/10",
  },
  "type-file": {
    colorClass: "text-type-file",
    borderClass: "border-l-type-file",
    bgClass: "bg-type-file/10",
  },
  "type-image": {
    colorClass: "text-type-image",
    borderClass: "border-l-type-image",
    bgClass: "bg-type-image/10",
  },
  "type-link": {
    colorClass: "text-type-link",
    borderClass: "border-l-type-link",
    bgClass: "bg-type-link/10",
  },
};

const FALLBACK_STYLE: ItemTypeStyle = {
  icon: File,
  colorClass: "text-muted-foreground",
  borderClass: "border-l-border",
  bgClass: "bg-muted",
};

/** "Snippet" -> "snippets" */
function toSlug(name: string) {
  return `${name.toLowerCase()}s`;
}

/** "Snippet" -> "Snippets" */
function toPlural(name: string) {
  return `${name}s`;
}

/** Icon and color classes for a type id, for color-coding cards and rows. */
export function getItemTypeStyle(itemTypeId: string): ItemTypeStyle {
  const type = itemTypes.find((entry) => entry.id === itemTypeId);
  const colors = TYPE_COLOR_CLASSES[itemTypeId];

  if (!type || !colors) {
    return FALLBACK_STYLE;
  }

  return { icon: TYPE_ICONS[type.icon] ?? FALLBACK_STYLE.icon, ...colors };
}

/** Singular type name for a type id, e.g. "Snippet". Empty when unknown. */
export function getItemTypeName(itemTypeId: string) {
  return itemTypes.find((entry) => entry.id === itemTypeId)?.name ?? "";
}

/**
 * Sidebar entries for every item type, with item counts derived from the mock
 * data. Reads from the mock module directly until the database is wired up.
 */
export function getItemTypeNav(): ItemTypeNavEntry[] {
  return itemTypes.map((type) => ({
    id: type.id,
    label: toPlural(type.name),
    href: `/items/${toSlug(type.name)}`,
    count: items.filter((item) => item.itemTypeId === type.id).length,
    ...getItemTypeStyle(type.id),
  }));
}
