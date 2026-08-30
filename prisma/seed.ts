/**
 * Development seed data.
 *
 * Run with: npm run db:seed
 *
 * Creates a demo user, the 7 system item types, and 5 collections holding 18
 * tagged items. Safe to re-run: system types are matched by name, and the demo
 * user's collections and items are cleared before being recreated.
 *
 * Scoped entirely to the demo user — it never touches other users' rows. Point
 * this at the development branch only, never production.
 */

// Prisma 7 does not load .env automatically, and this runs outside Next.js.
import "dotenv/config";

import bcrypt from "bcryptjs";

import { ContentType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const DEMO_EMAIL = "demo@devstash.io";
const DEMO_PASSWORD = "12345678";
const BCRYPT_ROUNDS = 12;

type SystemTypeName =
  | "snippet"
  | "prompt"
  | "command"
  | "note"
  | "file"
  | "image"
  | "link";

interface SystemType {
  name: SystemTypeName;
  icon: string;
  color: string;
}

interface SeedItem {
  title: string;
  type: SystemTypeName;
  description: string;
  tags: string[];
  content?: string;
  url?: string;
  language?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
}

interface SeedCollection {
  name: string;
  description: string;
  isFavorite?: boolean;
  items: SeedItem[];
}

/** Icons are lucide-react component names; colors match project-overview.md. */
const SYSTEM_TYPES: SystemType[] = [
  { name: "snippet", icon: "Code", color: "#3b82f6" },
  { name: "prompt", icon: "Sparkles", color: "#8b5cf6" },
  { name: "command", icon: "Terminal", color: "#f97316" },
  { name: "note", icon: "StickyNote", color: "#fde047" },
  { name: "file", icon: "File", color: "#6b7280" },
  { name: "image", icon: "Image", color: "#ec4899" },
  { name: "link", icon: "Link", color: "#10b981" },
];

/** A type's name determines which payload column an item uses. */
function contentTypeFor(type: SystemTypeName): ContentType {
  if (type === "link") return ContentType.url;
  if (type === "file" || type === "image") return ContentType.file;
  return ContentType.text;
}

const COLLECTIONS: SeedCollection[] = [
  {
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    isFavorite: true,
    items: [
      {
        title: "useDebounce hook",
        tags: ["react", "hooks", "typescript"],
        type: "snippet",
        language: "typescript",
        description: "Delays a rapidly changing value — search inputs, filters.",
        isPinned: true,
        content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
      },
      {
        title: "useLocalStorage hook",
        tags: ["react", "hooks", "storage"],
        type: "snippet",
        language: "typescript",
        description: "State that survives a reload, with SSR-safe initialisation.",
        content: `import { useCallback, useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // Private mode or blocked storage — fall back to the initial value.
    }
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Ignore quota and access errors; state still updates in memory.
      }
    },
    [key],
  );

  return [value, update] as const;
}`,
      },
      {
        title: "Typed context provider",
        tags: ["react", "typescript", "context"],
        type: "snippet",
        language: "typescript",
        description:
          "Creates a context whose hook throws outside its provider, so the value is never undefined.",
        content: `import { createContext, useContext } from "react";

export function createSafeContext<T>(name: string) {
  const Context = createContext<T | null>(null);

  function useSafeContext(): T {
    const value = useContext(Context);
    if (value === null) {
      throw new Error(\`use\${name} must be used inside <\${name}Provider>\`);
    }
    return value;
  }

  return [Context.Provider, useSafeContext] as const;
}`,
      },
    ],
  },
  {
    name: "AI Workflows",
    description: "AI prompts and workflow automations",
    isFavorite: true,
    items: [
      {
        title: "Code review prompt",
        tags: ["ai", "code-review"],
        type: "prompt",
        description: "Reviews a diff for correctness, security and readability.",
        isPinned: true,
        content: `You are a senior engineer reviewing a pull request.

Review the diff below for:
1. Correctness — logic errors, unhandled edge cases, race conditions
2. Security — injection, authz gaps, leaked secrets, unvalidated input
3. Performance — N+1 queries, unnecessary re-renders, blocking work
4. Readability — naming, dead code, functions doing too much

For each finding give: the file and line, why it matters, and a concrete fix.
Rank findings by severity. If something is only a preference, label it "nit".
Say so plainly when the diff looks correct rather than inventing problems.

Diff:
"""
{{DIFF}}
"""`,
      },
      {
        title: "Documentation generator",
        tags: ["ai", "docs"],
        type: "prompt",
        description: "Turns a module into reference docs with runnable examples.",
        content: `Write reference documentation for the code below.

Include:
- A one-paragraph summary of what it does and when to reach for it
- Every exported function: signature, parameters, return value, thrown errors
- A short runnable example per export
- Any gotchas a caller would hit (side effects, ordering, async behaviour)

Match the existing docs' voice. Document only what the code actually does —
never invent parameters or behaviour that is not present.

Code:
"""
{{CODE}}
"""`,
      },
      {
        title: "Refactoring assistant",
        tags: ["ai", "refactoring"],
        type: "prompt",
        description: "Proposes behaviour-preserving refactors, ranked by payoff.",
        content: `Refactor the code below without changing its observable behaviour.

Prioritise, in order:
1. Removing duplication
2. Splitting functions that do more than one thing
3. Naming that reveals intent
4. Deleting dead code and unused imports

Constraints:
- Keep the public API identical unless I say otherwise
- Preserve existing error handling semantics
- Do not add dependencies

Return the refactored code, then a short list of what changed and why.

Code:
"""
{{CODE}}
"""`,
      },
    ],
  },
  {
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    items: [
      {
        title: "Multi-stage Dockerfile for Next.js",
        tags: ["docker", "nextjs", "ci"],
        type: "snippet",
        language: "dockerfile",
        description: "Standalone output build — small final image, non-root user.",
        content: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -S -u 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        title: "Deploy with migrations",
        tags: ["deploy", "prisma"],
        type: "command",
        language: "bash",
        description:
          "Applies pending migrations before starting — never uses db push.",
        content: `npm ci && npx prisma migrate deploy && npm run build && npm run start`,
      },
      {
        title: "Docker multi-stage build docs",
        tags: ["docker", "docs"],
        type: "link",
        description: "Official guide to multi-stage builds and smaller images.",
        url: "https://docs.docker.com/build/building/multi-stage/",
      },
      {
        title: "GitHub Actions documentation",
        tags: ["ci", "github", "docs"],
        type: "link",
        description: "Workflow syntax, triggers and reusable actions.",
        url: "https://docs.github.com/en/actions",
      },
    ],
  },
  {
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    items: [
      {
        title: "Undo the last commit, keep changes",
        tags: ["git"],
        type: "command",
        language: "bash",
        description: "Moves HEAD back one commit, leaving the work staged.",
        content: `git reset --soft HEAD~1`,
      },
      {
        title: "Remove stopped containers and dangling images",
        tags: ["docker", "cleanup"],
        type: "command",
        language: "bash",
        description: "Reclaims disk after a lot of local image churn.",
        isPinned: true,
        content: `docker container prune -f && docker image prune -f`,
      },
      {
        title: "Find and kill whatever holds a port",
        tags: ["shell", "process"],
        type: "command",
        language: "bash",
        description: "For when the dev server says the port is already in use.",
        content: `lsof -ti :3000 | xargs kill -9`,
      },
      {
        title: "Find outdated and vulnerable packages",
        tags: ["npm", "security"],
        type: "command",
        language: "bash",
        description: "Quick dependency health check before a release.",
        content: `npm outdated; npm audit --omit=dev`,
      },
    ],
  },
  {
    name: "Design Resources",
    description: "UI/UX resources and references",
    items: [
      {
        title: "Tailwind CSS documentation",
        tags: ["css", "tailwind", "docs"],
        type: "link",
        description: "Utility class reference and the v4 CSS-first config.",
        url: "https://tailwindcss.com/docs",
      },
      {
        title: "shadcn/ui",
        tags: ["ui", "components"],
        type: "link",
        description: "Copy-in React components built on Radix and Tailwind.",
        url: "https://ui.shadcn.com",
      },
      {
        title: "Material Design 3",
        tags: ["design", "guidelines"],
        type: "link",
        description: "Design system reference for colour, type and motion.",
        url: "https://m3.material.io",
      },
      {
        title: "Lucide icons",
        tags: ["icons", "ui"],
        type: "link",
        description: "The icon set shadcn/ui uses; searchable catalogue.",
        url: "https://lucide.dev/icons",
      },
    ],
  },
];

/** Creates or updates the demo user, matched on the unique email. */
async function seedUser(): Promise<string> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo User", passwordHash, emailVerified: new Date() },
    create: {
      email: DEMO_EMAIL,
      name: "Demo User",
      passwordHash,
      isPro: false,
      emailVerified: new Date(),
    },
  });

  console.log(`✓ Demo user ${user.email}`);
  return user.id;
}

/**
 * System types have `userId = null`, and Postgres treats NULL as distinct from
 * NULL, so the @@unique([userId, name]) constraint does not dedupe them and an
 * upsert cannot be relied on. Match explicitly instead.
 */
async function seedSystemTypes(): Promise<Map<SystemTypeName, string>> {
  const ids = new Map<SystemTypeName, string>();

  for (const type of SYSTEM_TYPES) {
    const existing = await prisma.itemType.findFirst({
      where: { name: type.name, userId: null },
    });

    const record = existing
      ? await prisma.itemType.update({
          where: { id: existing.id },
          data: { icon: type.icon, color: type.color, isSystem: true },
        })
      : await prisma.itemType.create({
          data: { ...type, isSystem: true },
        });

    ids.set(type.name, record.id);
  }

  console.log(`✓ ${ids.size} system item types`);
  return ids;
}

/** Clears the demo user's own collections and items so re-runs stay clean. */
async function clearDemoData(userId: string): Promise<void> {
  const { count: items } = await prisma.item.deleteMany({ where: { userId } });
  const { count: collections } = await prisma.collection.deleteMany({
    where: { userId },
  });

  if (items > 0 || collections > 0) {
    console.log(
      `✓ Cleared previous demo data (${collections} collections, ${items} items)`,
    );
  }
}

/** Creates one collection and its items, linked through the join table. */
async function seedCollection(
  collection: SeedCollection,
  userId: string,
  typeIds: Map<SystemTypeName, string>,
): Promise<number> {
  const created = await prisma.collection.create({
    data: {
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite ?? false,
      userId,
      defaultTypeId: typeIds.get(collection.items[0].type),
    },
  });

  for (const item of collection.items) {
    const itemTypeId = typeIds.get(item.type);
    if (!itemTypeId) throw new Error(`Unknown item type: ${item.type}`);

    await prisma.item.create({
      data: {
        title: item.title,
        description: item.description,
        contentType: contentTypeFor(item.type),
        content: item.content ?? null,
        url: item.url ?? null,
        language: item.language ?? null,
        isPinned: item.isPinned ?? false,
        isFavorite: item.isFavorite ?? false,
        userId,
        itemTypeId,
        collections: { create: { collectionId: created.id } },
        tags: {
          connectOrCreate: item.tags.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    });
  }

  return collection.items.length;
}

/**
 * The seed plants a known password and clears the demo user's rows, so it must
 * never run against production. `ALLOW_SEED=true` is the deliberate override for
 * seeding a production-like environment on purpose.
 *
 * Not gated on an opt-in alone: `prisma.config.ts` registers this file under
 * `migrations.seed`, so Prisma runs it as part of `prisma migrate dev`, and a
 * variable nobody sets would break `npm run db:migrate`.
 */
function assertSafeTarget(): void {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
    throw new Error(
      "Refusing to seed: NODE_ENV is production. Set ALLOW_SEED=true to override.",
    );
  }

  // Surfaces a mistargeted run in the output even when NODE_ENV says nothing.
  console.log(`Seeding ${databaseHost()}`);
}

/** Host only - the connection string carries credentials that must not be logged. */
function databaseHost(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    return "unknown host";
  }

  try {
    return new URL(url).host;
  } catch {
    return "unparseable DATABASE_URL";
  }
}

async function main(): Promise<void> {
  assertSafeTarget();

  const userId = await seedUser();
  const typeIds = await seedSystemTypes();

  await clearDemoData(userId);

  let totalItems = 0;
  for (const collection of COLLECTIONS) {
    totalItems += await seedCollection(collection, userId, typeIds);
  }

  console.log(`✓ ${COLLECTIONS.length} collections with ${totalItems} items`);
  console.log("\nSeed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("\n✗ Seed failed:");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
