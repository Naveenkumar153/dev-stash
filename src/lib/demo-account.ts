/**
 * The seeded demo account (`prisma/seed.ts`), shared by everyone trying the
 * app with its published password. Anything one visitor could use against the
 * next - deleting it, changing its password, its billing - is refused for it.
 * Dependency-free, so billing and the actions can import it without loading auth.
 */
export const DEMO_USER_EMAIL = "demo@devstash.io";

export function isDemoEmail(email: string): boolean {
  return email === DEMO_USER_EMAIL;
}
