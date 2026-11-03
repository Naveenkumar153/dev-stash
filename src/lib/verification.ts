import { getAppUrl, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { checkToken, deleteTokens, replaceToken, wasIssuedWithin } from "@/lib/tokens";

export const VERIFY_EMAIL_PATH = "/api/auth/verify-email";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Off only when `EMAIL_VERIFICATION_ENABLED` is exactly `false`, so an unset
 * or mistyped variable keeps verification on. While off, accounts register
 * unverified and sign in anyway; turning it back on requires them to verify.
 */
export function isEmailVerificationEnabled(): boolean {
  return process.env.EMAIL_VERIFICATION_ENABLED !== "false";
}

/**
 * Replaces any earlier token for `email` with a fresh one and emails the link.
 * Returns `false` without sending when the last email went out under a minute
 * ago, so the resend button can't be used to flood an inbox.
 */
export async function issueVerificationEmail(email: string, name: string | null): Promise<boolean> {
  if (await wasIssuedWithin(email, TOKEN_TTL_MS, RESEND_COOLDOWN_MS)) {
    return false;
  }

  const token = await replaceToken(email, TOKEN_TTL_MS);

  const url = new URL(VERIFY_EMAIL_PATH, getAppUrl());
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  await sendVerificationEmail({ to: email, name, url: url.toString() });
  return true;
}

export type VerificationResult = "verified" | "invalid" | "expired";

/** Marks the user verified and spends the token, which works only once. */
export async function consumeVerificationToken(
  email: string,
  token: string,
): Promise<VerificationResult> {
  const status = await checkToken(email, token);
  if (status === "invalid") {
    return "invalid";
  }
  if (status === "expired") {
    await deleteTokens(email);
    return "expired";
  }

  // `updateMany` so a user deleted since registering spends the token
  // instead of throwing.
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email }, data: { emailVerified: new Date() } }),
    deleteTokens(email),
  ]);
  return "verified";
}
