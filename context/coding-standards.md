# Coding Standards

## TypeScript

- Strict mode enabled
- No `any` types - use proper typing or `unknown`
- Define interfaces for all props, API responses, and data models
- Use type inference where obvious, explicit types where helpful

## React

- Functional components only (no class components)
- Use hooks for state and side effects
- Keep components focused - one job per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `'use client'` when needed (interactivity, hooks, browser APIs)
- Use Server Actions for form submissions and simple mutations
- Use API routes when you need:
  - Webhooks (Stripe, GitHub, etc.)
  - File uploads with progress tracking
  - Long-running operations
  - Specific HTTP status codes or headers
  - Endpoints for future mobile/CLI clients
  - Third-party integrations
- Otherwise, fetch data directly in server components
- Dynamic routes for item/collection pages

## Tailwind CSS v4

**CRITICAL**: We are using Tailwind CSS v4, which uses CSS-based configuration.

- **DO NOT** create `tailwind.config.ts` or `tailwind.config.js` files (those are for v3)
- All theme configuration must be done in CSS using the `@theme` directive in `src/app/globals.css`
- Use CSS custom properties for colors, spacing, etc.
- No JavaScript-based config allowed

Example v4 configuration:

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(50% 0.2 250);
}
```

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx`
- Pages: `src/app/[route]/page.tsx`
- Server Actions: `src/actions/[feature].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Variables, functions, methods: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)
- env variables: SCREAMING_SNAKE_CASE

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- No inline styles
- Dark mode first, light mode as option

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching

- Server components fetch directly with Prisma
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages via toast

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
- Ensure proper typing
- Check for code duplication
- Verify error handling
- Review naming conventions
- Assess overall code structure and readability

## Testing

Unit tests use **Vitest** (`vitest.config.mts`) and cover **server actions and utilities only**.

- **What to test:** `src/actions/**` and the logic in `src/lib/**`, such as validation schemas, redirect and URL helpers, formatting, type metadata, and token and rate-limit rules.
- **What not to test:** components, pages and layouts. Verify those in the browser. There is no jsdom or React Testing Library, and the config only picks up `.ts` test files.
- **Location:** colocate the test beside the file it covers, named `<file>.test.ts` (for example `src/lib/format.ts` → `src/lib/format.test.ts`).
- **No real services:** a unit test never reaches the database, Redis, Resend or GitHub. Mock them with `vi.mock()`:
  - `@/lib/prisma` - a stub with only the model methods the code under test calls
  - `@/auth` - `auth` / `signIn` / `signOut`
  - `@/lib/password` - so bcrypt doesn't slow the suite
  - `@/lib/email`, `next/headers` and `next/navigation` when the code calls them

  `vitest.setup.ts` clears `DATABASE_URL` and the other service variables, so a forgotten Prisma mock fails with "DATABASE_URL is not set" instead of connecting.
- **Environment:** set variables with `vi.stubEnv()`, never by assigning to `process.env`. They're restored after each test (`unstubEnvs`), and mocks are reset (`mockReset`).
- **Time:** use `vi.useFakeTimers()` + `vi.setSystemTime()` for anything that depends on the current time.
- **Cases:** cover the happy path and each error branch the code returns, such as not signed in, invalid input, not found, and a failed dependency. Assert on what the caller sees (the `{ success, data, error }` result) and on the calls that matter, such as the exact `where` scoping or that nothing was written.
- **Judgement:** don't write tests just to have them. Skip code that is only a pass-through to Prisma or a library.
