import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getSession, getSessionUserId } from "@/lib/session";
import type { SessionUser } from "@/types/auth";


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
 * The signed-in user's row for the app shell: display details, plan and editor
 * preferences in one read, shared by `getSessionUser()` and
 * `getEditorPreferences()`. Null when signed out, or when the session outlived
 * its user.
 */
export const getSessionUserRow = cache(async () => {
  const session = await getSession();
  if (!session?.user?.id) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, isPro: true, editorPreferences: true },
  });
});

/**
 * The signed-in user's display details, read from their row rather than the
 * JWT, which is frozen at sign-in - so a renamed account or a new avatar shows
 * straight away. Null when signed out, or when the session outlived its user.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const user = await getSessionUserRow();
  if (!user) {
    return null;
  }

  // GitHub accounts may have no display name, so fall back to the email.
  return { name: user.name ?? user.email, email: user.email, image: user.image, isPro: user.isPro };
});
