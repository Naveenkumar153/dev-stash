import { createHash, randomBytes } from "node:crypto";

import { getAppUrl, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

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

// Only the hash is stored, so a leaked `verification_tokens` row can't be
// turned into a working link.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Replaces any earlier token for `email` with a fresh one and emails the link.
 * Returns `false` without sending when the last email went out under a minute
 * ago, so the resend button can't be used to flood an inbox.
 */
export async function issueVerificationEmail(email: string, name: string | null): Promise<boolean> {
  const latest = await prisma.verificationToken.findFirst({
    where: { identifier: email },
    orderBy: { expires: "desc" },
    select: { expires: true },
  });
  // Tokens carry no creation time; it is `expires` minus the TTL.
  if (latest && latest.expires.getTime() - TOKEN_TTL_MS + RESEND_COOLDOWN_MS > Date.now()) {
    return false;
  }

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashToken(token),
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

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
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token: hashToken(token) } },
    select: { expires: true },
  });

  if (!record) {
    return "invalid";
  }
  if (record.expires.getTime() < Date.now()) {
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
    return "expired";
  }

  // `updateMany` so a user deleted since registering spends the token
  // instead of throwing.
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email }, data: { emailVerified: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { identifier: email } }),
  ]);
  return "verified";
}
