# Current Feature

<!-- Feature Name -->

Dashboard UI Phase 3 — Main Area

## Status

<!-- Not Started|In Progress|Completed -->

In Progress

## Goals

<!-- Goals & requirements -->

Phase 3 of 3 for the dashboard UI. Build the main content area to the right of
the sidebar, using `src/lib/mock-data.ts` directly until the database is wired
up. Reference: `context/screenshots/dashboard-ui-main.png`.

- The main area to the right (page header + sections)
- 4 stats cards at the top: total items, collections, favorite items, favorite
  collections (not in the screenshot)
- Recent collections as color-coded cards — background/border color derived from
  the item type the collection holds most of
- Pinned items
- 10 recent items

## Notes

<!-- Any extra notes -->

- Item cards are color-coded by type on their border, per the project spec.
- `/items/TYPE`, `/collections/ID` and `/collections` routes do not exist yet;
  links point at them for when they land.
- Server components only — nothing here needs client state.

## History

<!-- Keep this updated. Earliest to latest -->

- Initial setup of Next.js
- Project setup and boilerplate cleanup
- Dashboard UI Phase 1: shadcn/ui init, /dashboard route, top bar (search + New Item), dark mode by default, Sidebar/Main placeholders
- Dashboard UI Phase 1 (rebuild): sidebar as a full-height column with the top bar inside the content column, New Collection button added to the top bar, Geist font variables wired into the theme, item type colors added as global tokens, real DevStash metadata
- Dashboard UI Phase 2: real sidebar replacing the placeholder - collapsible desktop column with an icon rail, mobile drawer, top bar toggle, item types linking to /items/TYPE, favorite and recent collections, user avatar area, shadcn avatar/separator/sheet/tooltip added
