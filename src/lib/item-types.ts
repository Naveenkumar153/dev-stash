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

/**
 * The system types, keyed by name. Names are stable across the mock data and
 * the database (rows use generated ids), so they are what the UI styles by.
 *
 * Type colors live as tokens in globals.css. They are spelled out here rather
 * than built from the type name so Tailwind can see every class name. Key order
 * is display order.
 */
const TYPE_STYLES: Record<string, ItemTypeStyle> = {
  snippet: {
    icon: Code,
    colorClass: "text-type-snippet",
    borderClass: "border-l-type-snippet",
    bgClass: "bg-type-snippet/10",
  },
  prompt: {
    icon: Sparkles,
    colorClass: "text-type-prompt",
    borderClass: "border-l-type-prompt",
    bgClass: "bg-type-prompt/10",
  },
  command: {
    icon: Terminal,
    colorClass: "text-type-command",
    borderClass: "border-l-type-command",
    bgClass: "bg-type-command/10",
  },
  note: {
    icon: StickyNote,
    colorClass: "text-type-note",
    borderClass: "border-l-type-note",
    bgClass: "bg-type-note/10",
  },
  file: {
    icon: File,
    colorClass: "text-type-file",
    borderClass: "border-l-type-file",
    bgClass: "bg-type-file/10",
  },
  image: {
    icon: Image,
    colorClass: "text-type-image",
    borderClass: "border-l-type-image",
    bgClass: "bg-type-image/10",
  },
  link: {
    icon: Link,
    colorClass: "text-type-link",
    borderClass: "border-l-type-link",
    bgClass: "bg-type-link/10",
  },
};

/** System type names, in the order they are shown across the UI. */
export const ITEM_TYPE_ORDER = Object.keys(TYPE_STYLES);

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

/** "snippet" -> "Snippets" */
function toPlural(name: string) {
  return `${getItemTypeLabel(name)}s`;
}

/** Icon and color classes for a type name, e.g. "snippet". */
export function getItemTypeStyleByName(name: string): ItemTypeStyle {
  const style: ItemTypeStyle | undefined = TYPE_STYLES[name.toLowerCase()];

  return style ?? FALLBACK_STYLE;
}

/** "snippet" -> "Snippet". Type names are stored lowercase in the database. */
export function getItemTypeLabel(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Icon and color classes for a type id, for color-coding cards and rows. */
export function getItemTypeStyle(itemTypeId: string): ItemTypeStyle {
  const type = itemTypes.find((entry) => entry.id === itemTypeId);

  return type ? getItemTypeStyleByName(type.name) : FALLBACK_STYLE;
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
