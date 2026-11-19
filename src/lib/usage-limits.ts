import { Prisma } from "@/generated/prisma/client";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * The Pro gating hooks. Gates check `hasProAccess`, never `isPro`, so with
 * `PRO_GATING_ENABLED` unset every account gets everything, as the project
 * spec asks during development. Counts are for the user id passed in: the
 * session user, the same account every page lists.
 */

/**
 * Whether Free-tier limits and Pro-only features are enforced: only for the
 * exact string "true". The only reader of `PRO_GATING_ENABLED`.
 */
export function isProGatingEnabled(): boolean {
  return process.env.PRO_GATING_ENABLED === "true";
}

export interface SessionEntitlements {
  userId: string;
  /** The stored subscription state, re-read into the JWT on every `auth()`. */
  isPro: boolean;
  /** What gates check: Pro, or gating switched off. */
  hasProAccess: boolean;
}

/** The signed-in user's id and plan, or null without a session. */
export async function getSessionEntitlements(): Promise<SessionEntitlements | null> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return null;
  }

  const isPro = session.user.isPro === true;
  return { userId, isPro, hasProAccess: isPro || !isProGatingEnabled() };
}

export type LimitCheck = { allowed: true } | { allowed: false; limit: number };

async function checkLimit(
  hasProAccess: boolean,
  limit: number,
  count: () => Promise<number>,
): Promise<LimitCheck> {
  if (hasProAccess) {
    return { allowed: true };
  }
  return (await count()) < limit ? { allowed: true } : { allowed: false, limit };
}

/** Whether the user may create one more item. */
export function canCreateItem(userId: string, hasProAccess: boolean): Promise<LimitCheck> {
  return checkLimit(hasProAccess, FREE_ITEM_LIMIT, () =>
    prisma.item.count({ where: { userId } }),
  );
}

export type LimitedCreate<T> = { allowed: true; value: T } | { allowed: false; limit: number };

type Db = Prisma.TransactionClient;

// Postgres aborts one of two serializable transactions that conflict; the
// loser retries once, now seeing the winner's row.
const SERIALIZABLE_ATTEMPTS = 2;

function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Runs `create` only while `count` is under `limit`, with both in one
 * serializable transaction, so parallel creates can't each see room under the
 * cap and all insert. With Pro access there is no cap and no count.
 */
async function createWithinLimit<T>(
  hasProAccess: boolean,
  limit: number,
  count: (db: Db) => Promise<number>,
  create: (db: Db) => Promise<T>,
): Promise<LimitedCreate<T>> {
  if (hasProAccess) {
    return { allowed: true, value: await create(prisma) };
  }

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx): Promise<LimitedCreate<T>> =>
          (await count(tx)) < limit
            ? { allowed: true, value: await create(tx) }
            : { allowed: false, limit },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (attempt >= SERIALIZABLE_ATTEMPTS || !isSerializationFailure(error)) {
        throw error;
      }
    }
  }
}

/** Creates an item through `create` unless the user is at the Free item limit. */
export function createItemWithinLimit<T>(
  userId: string,
  hasProAccess: boolean,
  create: (db: Db) => Promise<T>,
): Promise<LimitedCreate<T>> {
  return createWithinLimit(
    hasProAccess,
    FREE_ITEM_LIMIT,
    (db) => db.item.count({ where: { userId } }),
    create,
  );
}

/** Creates a collection through `create` unless the user is at the Free collection limit. */
export function createCollectionWithinLimit<T>(
  userId: string,
  hasProAccess: boolean,
  create: (db: Db) => Promise<T>,
): Promise<LimitedCreate<T>> {
  return createWithinLimit(
    hasProAccess,
    FREE_COLLECTION_LIMIT,
    (db) => db.collection.count({ where: { userId } }),
    create,
  );
}

export interface Usage {
  items: number;
  collections: number;
}

/** The user's item and collection totals, for the Billing card. */
export async function getUsage(userId: string): Promise<Usage> {
  const [items, collections] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
  ]);
  return { items, collections };
}
