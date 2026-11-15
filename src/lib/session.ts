import { auth } from "@/auth";

/**
 * The signed-in user's id, or null without a valid session. Server actions and
 * API routes scope every write to it, so another user's row fails like a
 * missing one.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();

  return session?.user?.id ?? null;
}
