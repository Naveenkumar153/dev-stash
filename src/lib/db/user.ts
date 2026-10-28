import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/types/auth";

/**
 * The seeded demo account. Stands in for the signed-in user until NextAuth
 * lands — every query scopes to whatever this returns, so swapping it for the
 * real session is a one-function change.
 */
const DEMO_USER_EMAIL = "demo@devstash.io";

/**
 * Owner id for the dashboard's queries. Null when the database is unseeded.
 *
 * Cached per request: every db module calls this, and they would otherwise
 * repeat the same lookup once each.
 */
export const getCurrentUserId = cache(async (): Promise<string | null> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  return user?.id ?? null;
});

/**
 * The signed-in user's display details, read from their row rather than the
 * JWT, which is frozen at sign-in - so a renamed account or a new avatar shows
 * straight away. Null when signed out, or when the session outlived its user.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true },
  });
  if (!user) {
    return null;
  }

  // GitHub accounts may have no display name, so fall back to the email.
  return { name: user.name ?? user.email, email: user.email, image: user.image };
});
