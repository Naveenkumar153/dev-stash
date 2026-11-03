import { RESET_PASSWORD_PATH } from "@/lib/auth-redirect";
import { getAppUrl, sendPasswordResetEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  checkToken,
  deleteTokens,
  replaceToken,
  wasIssuedWithin,
  type TokenStatus,
} from "@/lib/tokens";

const TOKEN_TTL_MS = 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

// Verification tokens use the bare email as their identifier and delete every
// token under it, so resets live under their own prefix.
function resetIdentifier(email: string): string {
  return `password-reset:${email}`;
}

/**
 * Replaces any earlier reset token for `email` and emails the link. Returns
 * `false` without sending when the last one went out under a minute ago.
 */
export async function issuePasswordResetEmail(email: string, name: string | null): Promise<boolean> {
  const identifier = resetIdentifier(email);
  if (await wasIssuedWithin(identifier, TOKEN_TTL_MS, RESEND_COOLDOWN_MS)) {
    return false;
  }

  const token = await replaceToken(identifier, TOKEN_TTL_MS);
  const url = new URL(RESET_PASSWORD_PATH, getAppUrl());
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  await sendPasswordResetEmail({ to: email, name, url: url.toString() });
  return true;
}

/** Whether a reset link is still usable, without spending it. */
export function checkPasswordResetToken(email: string, token: string): Promise<TokenStatus> {
  return checkToken(resetIdentifier(email), token);
}

export type PasswordResetResult = "reset" | "invalid" | "expired";

/**
 * Sets the new password and spends the token, which works only once. The link
 * came from the user's inbox, so an unverified email is marked verified too.
 */
export async function resetPasswordWithToken(
  email: string,
  token: string,
  password: string,
): Promise<PasswordResetResult> {
  const identifier = resetIdentifier(email);
  const status = await checkToken(identifier, token);
  if (status === "invalid") {
    return "invalid";
  }
  if (status === "expired") {
    await deleteTokens(identifier);
    return "expired";
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email }, data: { passwordHash } }),
    prisma.user.updateMany({
      where: { email, emailVerified: null },
      data: { emailVerified: new Date() },
    }),
    deleteTokens(identifier),
  ]);
  return "reset";
}
