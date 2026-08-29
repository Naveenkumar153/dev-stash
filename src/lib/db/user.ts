import { cache } from "react";

import { prisma } from "@/lib/prisma";

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
