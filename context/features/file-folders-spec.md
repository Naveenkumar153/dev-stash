# File Folders

## Overview

As the number of files grows, users need to organize them. Add nested folders to
`/items/files`, created on the fly, with the existing Type and Uploaded filters
plus a new Sort control working across them.

Builds on File List View (`FileList`, `FileRow`, `FileTypeIcon`,
`src/lib/file-filters.ts`).

## Decisions (confirmed)

- **Nesting:** folders can contain folders to any depth, like Google Drive
- **Deleting a folder:** deletes everything inside it - sub-folders, the files
  in them and their R2 objects - after a confirmation that states how many
  folders and files will be deleted
- **Filter scope:** turning on a Type or Uploaded filter searches every file in
  every folder, not just the open one, and shows each result's folder path
- **Sorting:** a "Sort" chip beside the filters with Name, Size and Uploaded and
  an ascending/descending toggle (works on phones, where the column header is
  hidden)

## Requirements

### Data

- New `Folder` model: `id`, `name`, `userId` (cascade on user delete),
  `parentId` (nullable self-relation; null = top level), `createdAt`,
  `updatedAt`; indexed on `[userId, parentId]`
- `Item.folderId` (nullable, top level when null), indexed
- `Item.folder` uses `onDelete: SetNull`, never `Cascade`: deleting files must
  go through the app so their R2 objects are removed too; a database cascade
  would leave orphaned objects in the bucket
- Schema change through a Prisma migration (`npm run db:migrate`), never
  `db push`
- Folder names: trimmed, 1-100 characters, unique among siblings for the same
  user (case-insensitive), validated with Zod

### Navigation

- The open folder lives in the URL (`/items/files?folder=<id>`), so refresh,
  back/forward and links work; no param = top level
- A breadcrumb above the list: `Files > Parent > Child`, each segment a link
- Folder rows sit above file rows, with a folder icon, name, item count and
  date; clicking a folder row opens it
- An unknown folder id, or another user's, shows the not-found page

### Creating and managing folders

- A "New Folder" button beside "New File" opens a small dialog (name only) and
  creates the folder inside the open folder
- "New File" inside a folder uploads into that folder
- Each folder row has an actions menu: Rename, Move to..., Delete
- Each file row has an actions menu with Move to... (Download stays its own
  button)
- "Move to..." opens a folder picker (tree or drill-down) including the top
  level; moving a folder into itself or one of its own descendants is refused
  on the server
- Deleting a folder: confirmation with counts, then one transaction deleting
  the items and folders, then `discardStoredFiles()` for the collected keys

### Filters and sorting

- No filter active: the list shows the open folder's sub-folders, then its files
- Filter active: folders are hidden and the list shows every matching file in
  every folder as a flat list, each row showing its folder path (or "Files" for
  top level); clicking the path opens that folder
- Sort applies to folders and files separately, folders always first; folders
  sort by name for Name and Size, and by created date for Uploaded
- Default sort: Uploaded, newest first (today's behavior)
- The "N of M files" count and Clear filters keep working

### Server

- Server actions in `src/actions/folders.ts`: `createFolder`, `renameFolder`,
  `moveFolder`, `deleteFolder`, `moveItem` - each checks `auth()`, validates
  with Zod, scopes every query to the session user and returns
  `{ success, data, error }`
- Unit tests for every action (happy path, signed out, invalid input, not
  found, another user's folder, name clash, move-into-descendant, database
  failure) and for any pure helpers (path building, cycle check, sorting)

## Out of scope

- Drag-and-drop moving
- Folders for item types other than files
- Sharing folders
- Enforcing the Pro gate on files
