import { cache } from "react";

import { auth } from "@/auth";
import { countItemsByType, type ItemTypeCount } from "@/lib/db/items";
import { prisma } from "@/lib/prisma";

export interface ProfileUser {
  id: string;
  /** Null when the account has no display name, e.g. some GitHub users. */
  name: string | null;
  email: string;
  image: string | null;
  createdAt: Date;
  /** Whether the account can sign in with a password, and so change it. */
  hasPassword: boolean;
}

export interface ProfileStats {
  items: number;
  collections: number;
  types: ItemTypeCount[];
}

/**
 * The signed-in user's own row, read fresh like getSessionUser(). Null when
 * signed out, or when the session outlived its user.
 */
export const getProfileUser = cache(async (): Promise<ProfileUser | null> => {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      createdAt: true,
      passwordHash: true,
    },
  });
  if (!user) {
    return null;
  }

  // The hash never leaves this function, only whether there is one.
  const { passwordHash, ...profile } = user;
  return { ...profile, hasPassword: passwordHash !== null };
});

/**
 * Usage for the profile page. Scoped to `userId` - the signed-in user - not
 * getCurrentUserId(), so it can differ from the dashboard until that switches
 * to the session user too.
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [items, collections, types] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.collection.count({ where: { userId } }),
    countItemsByType(userId),
  ]);

  return { items, collections, types };
}
