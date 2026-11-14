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

export interface ItemTypeStyle {
  icon: LucideIcon;
  /** Tailwind text color class for the type. */
  colorClass: string;
  /** Tailwind left border color class, used on color-coded cards. */
  borderClass: string;
  /** Tailwind tinted background class, used behind a type icon. */
  bgClass: string;
  /** Tailwind solid background class, used for the sidebar's type dots. */
  dotClass: string;
}

/**
 * The system types, keyed by name. Database rows use generated ids, so the
 * name is what the UI styles by.
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
    dotClass: "bg-type-snippet",
  },
  prompt: {
    icon: Sparkles,
    colorClass: "text-type-prompt",
    borderClass: "border-l-type-prompt",
    bgClass: "bg-type-prompt/10",
    dotClass: "bg-type-prompt",
  },
  command: {
    icon: Terminal,
    colorClass: "text-type-command",
    borderClass: "border-l-type-command",
    bgClass: "bg-type-command/10",
    dotClass: "bg-type-command",
  },
  note: {
    icon: StickyNote,
    colorClass: "text-type-note",
    borderClass: "border-l-type-note",
    bgClass: "bg-type-note/10",
    dotClass: "bg-type-note",
  },
  file: {
    icon: File,
    colorClass: "text-type-file",
    borderClass: "border-l-type-file",
    bgClass: "bg-type-file/10",
    dotClass: "bg-type-file",
  },
  image: {
    icon: Image,
    colorClass: "text-type-image",
    borderClass: "border-l-type-image",
    bgClass: "bg-type-image/10",
    dotClass: "bg-type-image",
  },
  link: {
    icon: Link,
    colorClass: "text-type-link",
    borderClass: "border-l-type-link",
    bgClass: "bg-type-link/10",
    dotClass: "bg-type-link",
  },
};

/** System type names, in the order they are shown across the UI. */
const ITEM_TYPE_ORDER = Object.keys(TYPE_STYLES);

/**
 * Types a Pro subscription unlocks. The file-backed types are Pro-only; every
 * text and url type is free.
 */
const PRO_TYPE_NAMES = new Set(["file", "image"]);

const FALLBACK_STYLE: ItemTypeStyle = {
  icon: File,
  colorClass: "text-muted-foreground",
  borderClass: "border-l-border",
  bgClass: "bg-muted",
  dotClass: "bg-muted-foreground",
};

/**
 * URL segment for a type's item list. "snippet" -> "snippets". The one place
 * the slug is built, so the sidebar's links and the route's lookup agree.
 */
export function getItemTypeSlug(name: string) {
  return `${name.toLowerCase()}s`;
}

/** Route for a type's item list. "snippet" -> "/items/snippets" */
export function getItemTypeHref(name: string) {
  return `/items/${getItemTypeSlug(name)}`;
}

/** Plural label for a type. "snippet" -> "Snippets" */
export function getItemTypePlural(name: string) {
  return `${getItemTypeLabel(name)}s`;
}

/** Icon and color classes for a type name, e.g. "snippet". */
export function getItemTypeStyleByName(name: string): ItemTypeStyle {
  const style: ItemTypeStyle | undefined = TYPE_STYLES[name.toLowerCase()];

  return style ?? FALLBACK_STYLE;
}

/**
 * Whether a type needs a Pro subscription, e.g. "file". Marks the type in the
 * UI - it does not gate anything on its own.
 */
export function isProItemType(name: string) {
  return PRO_TYPE_NAMES.has(name.toLowerCase());
}

/**
 * The system types the New Item dialog creates, in display order. The file
 * types need uploads, which aren't built yet.
 */
export const CREATABLE_ITEM_TYPES = ["snippet", "prompt", "command", "note", "link"] as const;

export type CreatableItemType = (typeof CREATABLE_ITEM_TYPES)[number];

/**
 * The creatable type whose list page `pathname` is, e.g. "/items/notes" ->
 * "note". Null on any other page, including the file and image lists.
 */
export function getCreatableTypeFromPath(pathname: string): CreatableItemType | null {
  const slug = /^\/items\/([^/]+)\/?$/.exec(pathname)?.[1];

  return CREATABLE_ITEM_TYPES.find((type) => getItemTypeSlug(type) === slug) ?? null;
}

/** Whether the New Item dialog can create this type, e.g. "note" yes, "file" no. */
export function isCreatableItemType(name: string): name is CreatableItemType {
  return (CREATABLE_ITEM_TYPES as readonly string[]).includes(name);
}

/**
 * The type-specific fields an item can edit. Title, description and tags apply
 * to every type, so they aren't listed.
 */
export interface EditableItemFields {
  content: boolean;
  language: boolean;
  url: boolean;
}

/** Text-payload types edit their content; the two code types also a language. */
const CONTENT_TYPE_NAMES = new Set(["snippet", "prompt", "command", "note"]);
const CODE_TYPE_NAMES = new Set(["snippet", "command"]);
const MARKDOWN_TYPE_NAMES = new Set(["prompt", "note"]);
const URL_TYPE_NAMES = new Set(["link"]);

/** How an item's text content is shown and edited. */
export type ContentEditorKind = "code" | "markdown" | "plain";

/**
 * The editor for a type's content: "code" (snippet, command) in the code
 * editor, "markdown" (prompt, note) in the markdown editor, and "plain" for
 * any other type, e.g. a custom one.
 */
export function getContentEditorKind(name: string): ContentEditorKind {
  const type = name.toLowerCase();

  if (CODE_TYPE_NAMES.has(type)) return "code";
  if (MARKDOWN_TYPE_NAMES.has(type)) return "markdown";
  return "plain";
}

/**
 * Which type-specific fields an item of this type edits, e.g. "link" -> url.
 * The edit form shows only these and `updateItem` writes only these, so the
 * two can't disagree. Custom, file and image types edit none of them.
 */
export function getEditableItemFields(name: string): EditableItemFields {
  const type = name.toLowerCase();

  return {
    content: CONTENT_TYPE_NAMES.has(type),
    language: CODE_TYPE_NAMES.has(type),
    url: URL_TYPE_NAMES.has(type),
  };
}

/** "snippet" -> "Snippet". Type names are stored lowercase in the database. */
export function getItemTypeLabel(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Sorts type names into display order. Custom types have no place in that
 * order, so they follow the system types, alphabetically.
 */
export function compareItemTypeOrder(a: string, b: string) {
  const rank = (name: string) => {
    const index = ITEM_TYPE_ORDER.indexOf(name);

    return index === -1 ? ITEM_TYPE_ORDER.length : index;
  };

  return rank(a) - rank(b) || a.localeCompare(b);
}
