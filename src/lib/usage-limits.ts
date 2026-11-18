import { auth } from "@/auth";
import { FREE_COLLECTION_LIMIT, FREE_ITEM_LIMIT } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

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
  const session = await auth();
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

/** Whether the user may create one more collection. */
export function canCreateCollection(userId: string, hasProAccess: boolean): Promise<LimitCheck> {
  return checkLimit(hasProAccess, FREE_COLLECTION_LIMIT, () =>
    prisma.collection.count({ where: { userId } }),
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
