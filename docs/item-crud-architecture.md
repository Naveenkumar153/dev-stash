# Item CRUD Architecture

A design for creating, reading, updating and deleting items of all 7 system types (and future custom types) with:

- **one action file** for every item mutation,
- **`src/lib/db/`** for every read, called directly from server components,
- **one dynamic route**, `/items/[type]`, plus a shared drawer,
- **shared components** that adapt to the item's type.

Status: design only. Nothing here is built yet.

Sources: `context/project-overview.md`, `context/coding-standards.md`, `prisma/schema.prisma`, `docs/item-types.md`, `src/lib/item-types.ts`, `src/lib/db/*`, `src/actions/profile.ts`, `src/app/dashboard/*`, `src/proxy.ts`, and the Next.js 16.2 docs in `node_modules/next/dist/docs/`.

> The research prompt cites `docs/content-types.md` and `src/lib/constants.tsx`. Neither exists: the type research landed in `docs/item-types.md`, and type metadata is in `src/lib/item-types.ts`.

---

## 1. Principles

1. **Actions don't know about individual types. They only know content kinds.** An action never branches on `"snippet"` or `"image"`. It resolves the item's type, maps it to one of three content kinds (`text` / `url` / `file`), and validates and stores that kind's payload. This is all the server needs to enforce, and it keeps custom types working without action changes.
2. **Type-specific behavior lives in components.** Choices such as a code editor or a Markdown editor, a copy button, an image preview or a language picker are all presentation, so they belong in `src/components/items/`, in one registry keyed by type name.
3. **Reads go through `src/lib/db/`, and writes go through `src/actions/items.ts`.** This follows the coding standards ("Server components fetch directly with Prisma", "Client components use Server Actions") and the existing split (`lib/db/items.ts` and `actions/profile.ts`).
4. **Every query and mutation is scoped to the owner**, using `where: { id, userId }` and never `id` alone. Server Functions can be reached by a direct POST, so each one checks the session itself (Next 16 `mutating-data.md`: "Always verify authentication and authorization inside every Server Function").
5. **The type decides the content kind on the server.** The client never sends `contentType`.

---

## 2. Prerequisite: queries must read the session user

`getCurrentUserId()` in `src/lib/db/user.ts` still returns the **demo user** (`demo@devstash.io`) for every query, while any mutation would write as the **session** user. Without a fix, a signed-in user would create an item and never see it.

Before CRUD lands, `getCurrentUserId()` must return `(await auth())?.user?.id ?? null`. This is the "one-function change" its comment describes. It should stay wrapped in React `cache()`. Actions call `auth()` directly, as `changePassword()` does, so they don't depend on the request-cached reader.

---

## 3. File structure

```
src/
├── app/
│   └── (app)/                          ← NEW route group: shared shell, no URL segment
│       ├── layout.tsx                  ← moved from app/dashboard/layout.tsx (sidebar + top bar)
│       ├── dashboard/
│       │   └── page.tsx                ← unchanged URL /dashboard; also renders <ItemDrawer>
│       └── items/
│           └── [type]/
│               ├── page.tsx            ← /items/snippets, /items/links, …
│               └── loading.tsx         ← list skeleton
│
├── actions/
│   └── items.ts                        ← createItem, updateItem, deleteItem (all item mutations)
│
├── lib/
│   ├── db/
│   │   ├── items.ts                    ← + getItemsByType(), getItemById(); existing list queries
│   │   └── item-types.ts               ← + getItemTypeBySlug()
│   ├── item-types.ts                   ← + getContentKind(), getItemTypeSlug(); existing style map
│   └── item-schemas.ts                 ← Zod: shared fields + per-content-kind payload
│
└── components/
    └── items/
        ├── ItemCard.tsx                ← moved from components/dashboard/, href → ?item=<id>
        ├── ItemList.tsx                ← server: list of ItemCards + empty state
        ├── ItemDrawer.tsx              ← server: loads the item for ?item= / ?new=, renders the sheet
        ├── ItemSheet.tsx               ← client: shadcn Sheet bound to the URL (open/close)
        ├── ItemView.tsx                ← read mode: shared header + type viewer
        ├── ItemForm.tsx                ← client: create + edit, shared fields + type editor
        ├── DeleteItemDialog.tsx        ← client: alert-dialog → deleteItem
        ├── NewItemButton.tsx           ← client: top-bar button, picks the type from the route
        ├── item-type-ui.tsx            ← the type → viewer/editor registry (§6)
        ├── viewers/
        │   ├── CodeViewer.tsx          ← snippet, command
        │   ├── MarkdownViewer.tsx      ← note, prompt
        │   ├── LinkViewer.tsx          ← link
        │   ├── FileViewer.tsx          ← file
        │   └── ImageViewer.tsx         ← image
        └── editors/
            ├── TextContentEditor.tsx   ← content (+ language when the type uses it)
            ├── UrlEditor.tsx           ← url
            └── FileEditor.tsx          ← upload → fileUrl / fileName / fileSize
```

Placement follows the coding standards: actions in `src/actions/[feature].ts`, schemas beside `auth-schemas.ts`, and components in `src/components/[feature]/`. Result and summary interfaces stay next to the code that returns them, matching the existing `ItemSummary` in `lib/db/items.ts` and `ChangePasswordResult` in `actions/profile.ts`.

### Why a route group

`/items/[type]` needs the same sidebar and top bar as `/dashboard`, but that shell is currently `src/app/dashboard/layout.tsx` and applies only under `/dashboard`. Moving it to `src/app/(app)/layout.tsx` shares it without changing any URL. (The Profile Page feature avoided this same move, so the decision is still open. It is a structural refactor and needs approval: see §10.) Without the group, the layout would have to be duplicated in `app/items/layout.tsx`.

`src/proxy.ts`'s matcher gains `"/items/:path*"`. The layout's `getSessionUser()` redirect covers the rest, as it already does for `/dashboard`.

---

## 4. Routing

### `/items/[type]`: one page for every type

```tsx
// src/app/(app)/items/[type]/page.tsx  (sketch)
export default async function ItemTypePage({ params, searchParams }: PageProps<"/items/[type]">) {
  const { type: slug } = await params;              // Next 16: params is a Promise
  const itemType = await getItemTypeBySlug(slug);   // "snippets" → { id, name: "snippet" }
  if (!itemType) notFound();

  const items = await getItemsByType(itemType.id);

  return (
    <>
      <ItemTypeHeader typeName={itemType.name} count={items.length} />
      <ItemList items={items} typeName={itemType.name} />
      <ItemDrawer searchParams={await searchParams} defaultTypeName={itemType.name} />
    </>
  );
}
```

- **Slug → type.** The URL segment is the plural slug that `getItemTypeHref()` already builds (`/items/${name}s`). `getItemTypeBySlug(slug)` in `lib/db/item-types.ts` matches the slug against `getAvailableTypes(userId)`, which returns the system types plus the user's own custom types. It compares `getItemTypeSlug(type.name) === slug.toLowerCase()` rather than stripping a trailing "s", so `/items/snippet`, a typo, or another user's custom type all reach `notFound()`.
- **One slug helper.** Add `getItemTypeSlug(name)` to `src/lib/item-types.ts` and have `getItemTypeHref()` call it, so the link and the lookup can't drift apart.
- **No `generateStaticParams`.** The page reads the session and must stay dynamic. The db functions keep calling `await connection()` like the existing ones.
- **Pro types are listed, not hidden.** `/items/files` and `/items/images` render for everyone, matching the sidebar. Gating happens in `createItem` (§5), and `NewItemButton` shows the PRO state.

### The drawer: `?item=<id>` and `?new=<type>`

The spec says items open and are created in a **drawer**, not on a page. The drawer state therefore lives in a search param on whichever page is showing, not in a route:

| URL | Drawer shows |
| --- | --- |
| `/items/snippets` | nothing |
| `/items/snippets?item=clx…` | that item in read mode |
| `/items/snippets?item=clx…&edit=1` | that item in `ItemForm` (edit) |
| `/items/snippets?new=snippet` | `ItemForm` (create), type preselected |
| `/dashboard?item=clx…` | the same drawer, over the dashboard |

Benefits of this approach:

- **It fixes the open `/items/:x` conflict.** `ItemCard` links to `/items/<id>` today, which would collide with `/items/[type]`. Pointing the card at `?item=<id>` on the current path removes the second route entirely.
- **Drawer links can be shared and survive a reload**, and the item loads on the server like everything else. No client-side fetch is needed.
- **Closing is a navigation**: `router.replace(pathname)` without the param. Back closes the drawer.

Layouts don't receive `searchParams`, so each page that can host the drawer renders `<ItemDrawer searchParams={…} />` itself. Today that means two pages, `dashboard` and `items/[type]`, and later `collections/[id]`.

*Rejected: intercepting and parallel routes (`@drawer/(.)items/[id]`).* They need a real `/items/[id]` page underneath, which brings back the segment conflict, and they add slot `default.tsx` files for no gain over a search param.

---

## 5. Mutations: `src/actions/items.ts`

Every action follows the `"use server"` and `{ success, data, error, fieldErrors }` pattern from `actions/profile.ts`, with try/catch and a Zod parse.

```ts
"use server";

export interface ItemActionResult<T = null> {
  success: boolean;
  data: T;
  error: string | null;
  fieldErrors: FieldErrors;   // reuse the helper type from auth-schemas.ts
}

export async function createItem(input: ItemInput): Promise<ItemActionResult<{ id: string }>>
export async function updateItem(id: string, input: ItemInput): Promise<ItemActionResult<{ id: string }>>
export async function deleteItem(id: string): Promise<ItemActionResult>
```

The spec's pin and favorite toggles (`toggleItemPinned`, `toggleItemFavorite`) belong in this file too when they're built. They are small `updateMany({ where: { id, userId } })` calls.

### Steps, identical for every type

**createItem / updateItem**

1. `const session = await auth()`. If there's no `session.user.id`, return "You are not signed in."
2. `itemFormSchema.safeParse(input)`. On failure, return `fieldErrors` via `getFieldErrors()`.
3. **Resolve the type** from `itemTypeId` with `prisma.itemType.findFirst({ where: { id, OR: [{ isSystem: true }, { userId }] } })`. This rejects another user's custom type.
4. **Gate it (create only).** Call `assertCanCreate(user, type)`, a single hook that checks `isProItemType(type.name)` against `User.isPro` and the free tier's 50-item limit. Per the spec's dev note, the hook exists but allows everything during development.
5. **Derive the content kind** with `getContentKind(type.name)`, then re-parse the payload with that kind's schema (§5.1). The other kinds' columns are written as `null`, so a snippet can never carry a stale `url`.
6. **Check the collections**: every `collectionIds` entry must belong to `userId` (one `count` query).
7. **Write.** Create with `tags: { connectOrCreate }` and `collections: { create }`. Update with `updateMany` scoped to `{ id, userId }` for the scalars, then `tags: { set: [], connectOrCreate }` and a replace of the `ItemCollection` rows inside one `$transaction`.
8. Call `refresh()` from `next/cache`, then return `{ success: true, data: { id } }`.

**deleteItem**

1. `auth()`, as above.
2. Inside a `$transaction`, collect the item's tag ids, run `item.deleteMany({ where: { id, userId } })`, and if the count is 0 return "Item not found" rather than revealing that the id exists. `ItemCollection` rows cascade. Finally delete tags left with no items, the same cleanup `deleteAccount()` does.
3. `refresh()`, then success. The client closes the drawer and shows a toast.

### 5.1 Validation: `src/lib/item-schemas.ts`

```ts
const itemBaseSchema = z.object({
  itemTypeId:    z.string().cuid(),
  title:         z.string().trim().min(1).max(200),
  description:   z.string().trim().max(1000).optional(),
  tags:          z.array(tagNameSchema).max(20).default([]),
  collectionIds: z.array(z.string().cuid()).max(50).default([]),
});

// One schema per content KIND, not per type.
export const payloadSchemas = {
  text: z.object({ content: z.string().max(100_000), language: z.string().max(50).optional() }),
  url:  z.object({ url: z.string().trim().url().refine(isHttpUrl) }),
  file: z.object({ fileUrl: r2UrlSchema, fileName: z.string().max(255), fileSize: z.number().int().positive() }),
} satisfies Record<ContentType, z.ZodType>;
```

- The client never sends `contentType`. The action picks `payloadSchemas[getContentKind(type.name)]` after resolving the type in step 3.
- `url` accepts only `http:` and `https:` (`isHttpUrl`), so a `javascript:` link can't be stored and later rendered as `<a href>`.
- `fileUrl` must point at this app's R2 bucket. File bytes never pass through a Server Action: uploads go through an API route (the coding standards list "File uploads with progress tracking" under API routes), which stores the object and returns `{ fileUrl, fileName, fileSize }`. `FileEditor` puts those values into the form. Designing the upload route is outside this document.
- The limits above are suggestions to confirm during the feature.

### 5.2 The one shared type → kind mapping

Move the seed's private `contentTypeFor()` into `src/lib/item-types.ts` as `getContentKind(name)`, and have both `prisma/seed.ts` and the actions import it. This is the only place the server maps a type to a kind, and it matches the classification in `docs/item-types.md`:

| Kind | Types |
| --- | --- |
| `text` | snippet, prompt, command, note |
| `url` | link |
| `file` | file, image |

Custom types will need their kind stored on `ItemType`, since there's no column for it today. Until that migration exists, unknown names default to `text`.

### Why `refresh()`

Every item query calls `await connection()` and nothing uses `"use cache"` or tags, so after a mutation the server only needs to re-render the current route. Next 16's `refresh()` does exactly that from inside a Server Action, so the list, the counts and the sidebar all update. If cached reads are added later, switch to `updateTag()` for those tags.

---

## 6. Where type-specific logic lives

All 7 types differ only in presentation, so the differences live in one registry in the components layer:

```tsx
// src/components/items/item-type-ui.tsx
interface ItemTypeUi {
  Viewer: ComponentType<{ item: ItemDetail }>;
  Editor: ComponentType<ItemEditorProps>;
  /** Show the language picker and highlight with it. */
  usesLanguage?: boolean;
  defaultLanguage?: string;
  copyable?: boolean;
  contentPlaceholder?: string;
}

const TYPE_UI: Record<string, ItemTypeUi> = {
  snippet: { Viewer: CodeViewer,     Editor: TextContentEditor, usesLanguage: true, copyable: true },
  command: { Viewer: CodeViewer,     Editor: TextContentEditor, usesLanguage: true, defaultLanguage: "bash", copyable: true },
  prompt:  { Viewer: MarkdownViewer, Editor: TextContentEditor, copyable: true },
  note:    { Viewer: MarkdownViewer, Editor: TextContentEditor },
  link:    { Viewer: LinkViewer,     Editor: UrlEditor },
  file:    { Viewer: FileViewer,     Editor: FileEditor },
  image:   { Viewer: ImageViewer,    Editor: FileEditor },
};

/** Custom types fall back by content kind. */
export function getItemTypeUi(typeName: string): ItemTypeUi
```

It sits next to `TYPE_STYLES` (icon and colors, `src/lib/item-types.ts`) and is keyed the same way, by type name. The style map stays in `lib`, because it's plain data that the sidebar and cards already use. The registry lives in `components`, because its values are components.

| Type | Viewer | Editor | Specific behavior |
| --- | --- | --- | --- |
| snippet | `CodeViewer` | `TextContentEditor` + language | Syntax highlighting by `language`, copy button, monospace |
| command | `CodeViewer` | `TextContentEditor` + language (`bash`) | Copy button, monospace |
| prompt | `MarkdownViewer` | `TextContentEditor` | Copy button. "Optimize" (Pro AI) attaches here later |
| note | `MarkdownViewer` | `TextContentEditor` | Markdown editor and rendered Markdown |
| link | `LinkViewer` | `UrlEditor` | Hostname, opens in a new tab with `rel="noopener noreferrer"` |
| file | `FileViewer` | `FileEditor` | File name, formatted size, download |
| image | `ImageViewer` | `FileEditor` (accepts `image/*`) | Inline preview, download |

Adding a type, or changing how one looks, means editing this registry and maybe adding one viewer or editor. The actions, the queries and the route stay as they are.

---

## 7. Queries: `src/lib/db/`

| Function | File | Returns | Used by |
| --- | --- | --- | --- |
| `getItemTypeBySlug(slug)` | `item-types.ts` | `ItemTypeRow \| null` | `items/[type]/page.tsx` |
| `getItemsByType(typeId, limit?)` | `items.ts` | `ItemSummary[]` | `items/[type]/page.tsx` |
| `getItemById(id)` | `items.ts` | `ItemDetail \| null` | `ItemDrawer` |
| `getItemFormOptions()` | `items.ts` or `collections.ts` | available types + the user's collections | `ItemDrawer` (create and edit) |
| `getPinnedItems()` / `getRecentItems()` | `items.ts` | `ItemSummary[]` | dashboard (existing) |

- `getItemsByType` reuses `ITEM_CARD_SELECT`, `NEWEST_FIRST` and `toSummary()`, so list cards keep skipping payloads. `where: { userId, itemTypeId }` sorts newest first. The existing `[userId, createdAt desc, id desc]` index covers `userId`, but a composite `[userId, itemTypeId, createdAt desc, id desc]` index (a migration) would make the type filter an index scan as well. Add it with the feature. A limit (for example 50) with "load more" keeps the query bounded, like every other list query.
- `getItemById` uses `findFirst({ where: { id, userId } })` and is the only query that selects the full payload (`content`, `language`, `url`, `fileUrl`, `fileName`, `fileSize`) plus `tags` and `collections { collection { id, name } }`. The spec's "view which collections an item belongs to" comes from this result.
- `ItemDetail` is defined in `items.ts` as `ItemSummary` plus `itemTypeId`, `contentType`, the payload fields, `collections` and `updatedAt`.
- All of these begin with `await connection()` and `getCurrentUserId()`, like the existing queries.

---

## 8. Component responsibilities

| Component | Kind | Responsibility | Doesn't do |
| --- | --- | --- | --- |
| `items/[type]/page.tsx` | server | Resolves the slug, `notFound()`, loads the list, renders header, list and drawer | Type-specific rendering |
| `ItemList` | server | Renders `ItemCard`s for the type, with an empty state ("No snippets yet") and a create button | Fetching |
| `ItemCard` | server | The existing card. Its link changes to `?item=<id>` on the current path | Anything else changes |
| `ItemDrawer` | server | Reads `item` / `new` / `edit` from `searchParams`, calls `getItemById()` and `getItemFormOptions()`, picks read or form mode, renders `ItemSheet` around it. A missing or foreign id shows "Item not found" | Mutations |
| `ItemSheet` | client | shadcn `Sheet` (already installed). Open when the param is present; closing runs `router.replace()` without the params. Right side on desktop, full width on mobile | Data |
| `ItemView` | server | Shared header (type icon and color from `getItemTypeStyleByName()`, title, pin and favorite, tags, collections, dates) plus `getItemTypeUi(type).Viewer`. Edit and delete buttons | Per-type branching beyond the registry lookup |
| `ItemForm` | client | Shared fields (type select on create, title, description, tags, collections) plus `getItemTypeUi(type).Editor`. Calls `createItem` / `updateItem` in a transition, shows `fieldErrors`, toasts on success, navigates to `?item=<id>` | Deciding the content kind (the server does) |
| `TextContentEditor` / `UrlEditor` / `FileEditor` | client | Edit one content kind's fields. `TextContentEditor` shows the language picker when the registry sets `usesLanguage` | Saving |
| Viewers | server where possible | Render one type's payload. `CodeViewer` / `MarkdownViewer` hold the highlighting and Markdown rendering; the copy button is a small client child | Data access |
| `DeleteItemDialog` | client | shadcn `alert-dialog`, modeled on `DeleteAccountDialog`. Calls `deleteItem`, toasts, closes the drawer | — |
| `NewItemButton` | client | Replaces the static "New Item" in `TopBar`. Uses `usePathname()` to preselect the current page's type (`/items/links` → `?new=link`) and otherwise defaults to `snippet`. Shows PRO on file and image | — |

### Request flows

```
Open:    ItemCard ──Link──▶ /items/snippets?item=ID
         page.tsx ─▶ ItemDrawer ─▶ getItemById(ID) ─▶ ItemSheet › ItemView › CodeViewer

Create:  NewItemButton ─▶ ?new=snippet ─▶ ItemDrawer ─▶ ItemSheet › ItemForm › TextContentEditor
         submit ─▶ createItem() ─ auth · zod · type → kind · gate · write · refresh()
                └▶ router.replace(?item=NEW_ID) + toast

Edit:    ItemView "Edit" ─▶ ?item=ID&edit=1 ─▶ ItemForm (prefilled) ─▶ updateItem() ─▶ ?item=ID

Delete:  ItemView "Delete" ─▶ DeleteItemDialog ─▶ deleteItem() ─▶ router.replace(pathname) + toast
```

---

## 9. Suggested build order

Each step is a separate feature on its own branch, following the workflow in `context/ai-interaction.md`.

1. **Session-scoped queries.** `getCurrentUserId()` reads the session (§2).
2. **Route group and list pages.** Add `(app)/layout.tsx`, `/items/[type]`, `getItemTypeBySlug`, `getItemsByType`, the proxy matcher, and the type+date index migration.
3. **Drawer (read only).** Add `?item=`, `ItemDrawer`, `ItemSheet`, `ItemView`, the registry, viewers for the text and link kinds, and repoint `ItemCard`.
4. **Create, edit and delete for text and link types.** Add `actions/items.ts`, `item-schemas.ts`, `getContentKind()` (used by the seed too), `ItemForm`, `TextContentEditor`, `UrlEditor`, `DeleteItemDialog` and `NewItemButton`.
5. **File and image.** Add the R2 upload API route, `FileEditor`, `FileViewer` and `ImageViewer`, and enforce Pro in `assertCanCreate`.

---

## 10. Open decisions

| Decision | Recommendation |
| --- | --- |
| Move `app/dashboard/layout.tsx` into an `(app)` route group | Yes. It's the only way to share the shell without duplicating it, and URLs don't change. It's a structural refactor, so it needs approval. |
| Drawer via search param vs intercepting routes | Search param (§4) |
| Markdown editor and syntax highlighting libraries | Not chosen. Pick them in step 3 or 4, and keep them inside `MarkdownViewer`, `CodeViewer` and `TextContentEditor` so they can be swapped. |
| Plural slugs for custom types (`name + "s"`) | Fine for the 7 system types. Custom types need a stored slug or a uniqueness check when created. |
| Content kind for custom types | Needs a `contentType` column on `ItemType` (migration) when custom types are built |
| Tags are global (`Tag.name @unique`) | Unchanged here. Delete-time orphan cleanup treats tags as shared, as `deleteAccount()` does. Per-user scoping is still an open question in the spec. |
| `ItemCard` location | Move to `components/items/` in step 3, since the dashboard and the type pages both use it |
