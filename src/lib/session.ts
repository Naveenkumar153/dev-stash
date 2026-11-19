import { cache } from "react";

import { auth } from "@/auth";

/**
 * The request's session, read once. Each `auth()` decodes the JWT and runs the
 * `jwt` callback's user lookup, so every server reader goes through this rather
 * than calling `auth()` itself. Outside a React server render (route handlers,
 * tests) `cache()` doesn't memoize and this is a plain `auth()`.
 */
export const getSession = cache(async () => auth());

/**
 * The signed-in user's id, or null without a valid session. Server actions and
 * API routes scope every write to it, so another user's row fails like a
 * missing one.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();

  return session?.user?.id ?? null;
}
