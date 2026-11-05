# Item Types

DevStash ships 7 **system item types**. Every item belongs to exactly one type, and a type maps to one of three **content kinds** (`text`, `url`, `file`), which decide where an item's payload is stored.

Sources: `context/project-overview.md`, `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/item-types.ts`, `src/app/globals.css`, `src/components/dashboard/ItemCard.tsx`, `src/components/dashboard/CollectionCard.tsx`, `src/lib/db/*`.

> The research prompt lists `src/lib/constants.tsx` as a source, but that file doesn't exist. The type metadata it would hold is in `src/lib/item-types.ts`.

---

## At a glance

Rows follow `ITEM_TYPE_ORDER`, the display order used across the UI.

| Type | Icon (lucide) | Hex | Content kind | Tier | Planned route | Seeded items |
| --- | --- | --- | --- | --- | --- | --- |
| `snippet` | `Code` | `#3b82f6` (blue) | text | Free | `/items/snippets` | 4 |
| `prompt` | `Sparkles` | `#8b5cf6` (purple) | text | Free | `/items/prompts` | 3 |
| `command` | `Terminal` | `#f97316` (orange) | text | Free | `/items/commands` | 5 |
| `note` | `StickyNote` | `#fde047` (yellow) | text | Free | `/items/notes` | 0 |
| `file` | `File` | `#6b7280` (gray) | file | **Pro** | `/items/files` | 0 |
| `image` | `Image` | `#ec4899` (pink) | file | **Pro** | `/items/images` | 0 |
| `link` | `Link` | `#10b981` (emerald) | url | Free | `/items/links` | 6 |

The seed creates 18 items in total. None of the `/items/*` list routes exist yet (`src/app/items/` is absent); `getItemTypeHref()` already builds those paths for the sidebar.

---

## Per-type detail

### Snippet
- **Purpose:** Reusable code such as hooks, helpers, boilerplate and config files.
- **Icon / color:** `Code`, `#3b82f6`
- **Content kind:** `text`
- **Key fields:** `content` (the code), `language` (syntax-highlight hint; seeded as `typescript` and `dockerfile`), `title`, `description`
- **Seed examples:** `useDebounce hook`, `useLocalStorage hook`, `Typed context provider`, `Multi-stage Dockerfile for Next.js`

### Prompt
- **Purpose:** AI prompts, system messages and reusable instructions with `{{PLACEHOLDER}}` slots.
- **Icon / color:** `Sparkles`, `#8b5cf6`
- **Content kind:** `text`
- **Key fields:** `content` (the prompt body), `title`, `description`. Seeded prompts leave `language` unset.
- **Seed examples:** `Code review prompt`, `Documentation generator`, `Refactoring assistant`
- **Spec tie-in:** the AI prompt optimizer (Pro) is scoped to this type.

### Command
- **Purpose:** Terminal and shell one-liners: git, docker, npm, process management, deploy steps.
- **Icon / color:** `Terminal`, `#f97316`
- **Content kind:** `text`
- **Key fields:** `content` (the command line), `language` (seeded as `bash` on every command), `title`, `description`
- **Seed examples:** `git reset --soft HEAD~1`, `lsof -ti :3000 | xargs kill -9`, `Deploy with migrations`

### Note
- **Purpose:** Free-form Markdown notes, explanations and course notes.
- **Icon / color:** `StickyNote`, `#fde047`
- **Content kind:** `text`
- **Key fields:** `content` (Markdown), `title`, `description`. `language` isn't relevant.
- **Seed examples:** none. The seed creates no notes, so the type shows a count of 0.

### File
- **Purpose:** Uploaded documents and context files (for example the spec's *Context Files* collection).
- **Icon / color:** `File`, `#6b7280`
- **Content kind:** `file`
- **Key fields:** `fileUrl` (Cloudflare R2 URL), `fileName`, `fileSize` (bytes), `title`, `description`. `content` stays null.
- **Tier:** Pro (`PRO_TYPE_NAMES`)
- **Seed examples:** none. Uploads aren't built yet.

### Image
- **Purpose:** Uploaded images such as screenshots, diagrams and design references.
- **Icon / color:** `Image`, `#ec4899`
- **Content kind:** `file`
- **Key fields:** the same as File: `fileUrl`, `fileName`, `fileSize`, `title`, `description`
- **Tier:** Pro (`PRO_TYPE_NAMES`)
- **Seed examples:** none

### Link
- **Purpose:** Bookmarked URLs such as docs, references and tools.
- **Icon / color:** `Link`, `#10b981`
- **Content kind:** `url`
- **Key fields:** `url`, `title`, `description`. `content` stays null.
- **Seed examples:** `Tailwind CSS documentation`, `shadcn/ui`, `Lucide icons`, `GitHub Actions documentation`

---

## Classification: text vs file vs URL

`Item.contentType` (enum `ContentType { text, url, file }`, default `text`) records which payload column is populated:

| Content kind | Types | Payload columns used | Columns left null |
| --- | --- | --- | --- |
| `text` | snippet, prompt, command, note | `content`, optionally `language` | `url`, `fileUrl`, `fileName`, `fileSize` |
| `url` | link | `url` | `content`, file columns |
| `file` | file, image | `fileUrl`, `fileName`, `fileSize` | `content`, `url` |

Notes:

- **The mapping lives only in the seed.** `contentTypeFor()` in `prisma/seed.ts` derives the kind from the type name (`link` → `url`, `file`/`image` → `file`, everything else → `text`). No application code writes items yet, and nothing in the schema enforces that `contentType` agrees with the type or with which columns are filled. When item creation is built, this mapping should become shared app code, not a seed-only helper.
- `ItemType` has no `contentType` column, so a custom type can't declare its kind in the database yet. Custom types will need that before they can be created.

---

## Shared properties

### On every `ItemType` row

| Field | Notes |
| --- | --- |
| `id` | cuid. The UI never keys on it; it keys on `name`. |
| `name` | Stored lowercase (`snippet`); `getItemTypeLabel()` capitalizes it for display. |
| `icon` | lucide component name as a string (`"Code"`) |
| `color` | Hex string (`"#3b82f6"`) |
| `isSystem` | `true` for all 7. System types can't be edited or deleted. |
| `userId` | `null` for system types; set for future custom (Pro) types |

`@@unique([userId, name])` doesn't dedupe system types, because Postgres treats each `NULL` as distinct. The seed therefore matches system types by `findFirst({ name, userId: null })` instead of using an upsert.

### On every `Item`, regardless of type

`title` (required), `description`, `isFavorite`, `isPinned`, `tags` (many-to-many with the global, name-unique `Tag`), `collections` (many-to-many through `ItemCollection` with `addedAt`), `userId`, `itemTypeId`, `createdAt`, `updatedAt`.

Collections can hold items of any type. `Collection.defaultTypeId` points at an `ItemType` (the seed sets it to the type of each collection's first item).

---

## Display differences

### Where the styling comes from

- **The UI ignores the `icon` and `color` columns in the database.** `getAvailableTypes()` selects only `id` and `name`, and all styling is looked up by name from `TYPE_STYLES` in `src/lib/item-types.ts`.
- Each entry in `TYPE_STYLES` holds a lucide component plus four Tailwind classes built on the CSS tokens in `src/app/globals.css` (`--type-<name>` in `:root`, exposed as `--color-type-<name>` in `@theme`):

  | Class | Used for |
  | --- | --- |
  | `colorClass` (`text-type-*`) | Icon color |
  | `borderClass` (`border-l-type-*`) | 4px left edge on item and collection cards |
  | `bgClass` (`bg-type-*/10`) | Tinted square behind the item card's icon |
  | `dotClass` (`bg-type-*`) | Sidebar collection dots |

  The class names are written out in full rather than built from the type name, so that Tailwind can detect them.
- An unknown name (for example a future custom type) gets `FALLBACK_STYLE`: the `File` icon with muted or neutral colors.
- The hex values are defined in three places that must be kept in sync by hand: `context/project-overview.md`, `SYSTEM_TYPES` in `prisma/seed.ts`, and `globals.css`.

### How the UI differs by type today

Today, types differ only in icon and color. The cards share one layout for every type.

| Surface | What changes by type |
| --- | --- |
| **ItemCard** (pinned and recent lists) | Left border color, tinted icon square, icon. The title, description, tags, pin and star markers, and date are the same for every type. List queries deliberately skip `content` and the file and url payloads (`ITEM_CARD_SELECT`). |
| **CollectionCard** | Left border uses the collection's **dominant type** (the type it holds most items of; empty collections fall back to `border-l-border`). A row of small colored icons lists each type the collection holds, in `ITEM_TYPE_ORDER`. |
| **Sidebar** | One row per type in display order, with icon, plural label (`getItemTypePlural()`), item count and a link to `/items/<name>s`. `file` and `image` carry a **PRO** badge (`isProItemType()`), which only labels them and doesn't gate access. Custom types sort after the system types, alphabetically (`compareItemTypeOrder()`). |

### Planned but not built (from the spec)

- The item drawer, with type-specific bodies: a Markdown editor for the text types, syntax highlighting driven by `language` for snippets and commands, file upload for file and image, and URL handling for links.
- The `/items/<type>s` list pages.
- Pro gating of file and image, based on `User.isPro`. No code reads that flag yet.

---

## Observations

- `#fde047` (note yellow) is very light. It's defined only in `:root` and not redefined under `.dark`. It reads well on the dark default theme but will have weak contrast as text or a thin border in light mode.
- `ItemCard` links to `/items/<id>` while the type lists use `/items/<type>s`. Both share the `/items/[x]` segment, a conflict that is already logged as open in `context/current-feature.md`.
- Seed coverage is uneven. Note, file and image have no seeded items, so their card styling has never been exercised with real rows.
