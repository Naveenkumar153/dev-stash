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

export interface ItemTypeNavEntry {
  id: string;
  /** Plural label shown in the sidebar, e.g. "Snippets". */
  label: string;
  /** Route for the type's item list, e.g. "/items/snippets". */
  href: string;
  icon: LucideIcon;
  /** Tailwind text color class for the type. */
  colorClass: string;
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
const TYPE_COLOR_CLASSES: Record<string, string> = {
  "type-snippet": "text-type-snippet",
  "type-prompt": "text-type-prompt",
  "type-command": "text-type-command",
  "type-note": "text-type-note",
  "type-file": "text-type-file",
  "type-image": "text-type-image",
  "type-link": "text-type-link",
};

/** "Snippet" -> "snippets" */
function toSlug(name: string) {
  return `${name.toLowerCase()}s`;
}

/** "Snippet" -> "Snippets" */
function toPlural(name: string) {
  return `${name}s`;
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
    icon: TYPE_ICONS[type.icon] ?? File,
    colorClass: TYPE_COLOR_CLASSES[type.id] ?? "text-muted-foreground",
    count: items.filter((item) => item.itemTypeId === type.id).length,
  }));
}