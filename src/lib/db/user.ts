import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";
import type { SessionUser } from "@/types/auth";

/** The seeded demo account (`prisma/seed.ts`), which can't be deleted. */
export const DEMO_USER_EMAIL = "demo@devstash.io";

/**
 * Owner id for the read queries behind every page: the signed-in user, so
 * each account sees only its own items, collections and folders. Null when
 * signed out.
 *
 * Cached per request: every db module calls this, and they would otherwise
 * repeat the same session check once each.
 */
export const getCurrentUserId = cache(getSessionUserId);

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
    select: { name: true, email: true, image: true, isPro: true },
  });
  if (!user) {
    return null;
  }

  // GitHub accounts may have no display name, so fall back to the email.
  return { name: user.name ?? user.email, email: user.email, image: user.image, isPro: user.isPro };
});
