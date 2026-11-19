import bcrypt from "bcryptjs";

// `prisma/seed.ts` hashes through here too, so registered and seeded hashes
// cost the same.
const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

/**
 * A 12-round hash of a random string nobody knows, compared against when an
 * account has no password to check (an unknown email, a GitHub-only account),
 * so those sign-ins take as long as a wrong password and the response time
 * can't tell which emails are registered.
 */
const TIMING_DUMMY_HASH = "$2b$12$J9gau8JDlpYmm3c1iGYB6ey3zS9qoq2jn6Y49YjanfLVkyVa2geu2";

/**
 * Whether `password` matches `passwordHash`, always paying for one bcrypt
 * compare: a missing hash is compared against the dummy and fails.
 */
export async function checkPassword(password: string, passwordHash: string | null) {
  const matches = await verifyPassword(password, passwordHash ?? TIMING_DUMMY_HASH);
  return passwordHash !== null && matches;
}
