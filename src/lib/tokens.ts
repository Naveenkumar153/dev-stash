import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * One-time tokens stored in `verification_tokens`. Each flow namespaces its
 * `identifier` (e.g. the bare email for verification, `password-reset:email`
 * for resets) so issuing one kind never deletes another.
 */

// Only the hash is stored, so a leaked `verification_tokens` row can't be
// turned into a working link.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Whether a token for `identifier` was issued under `cooldownMs` ago. Tokens
 * carry no creation time; it is `expires` minus the TTL they were issued with.
 */
export async function wasIssuedWithin(
  identifier: string,
  ttlMs: number,
  cooldownMs: number,
): Promise<boolean> {
  const latest = await prisma.verificationToken.findFirst({
    where: { identifier },
    orderBy: { expires: "desc" },
    select: { expires: true },
  });
  return !!latest && latest.expires.getTime() - ttlMs + cooldownMs > Date.now();
}

/** Replaces any earlier token for `identifier` and returns the new raw token. */
export async function replaceToken(identifier: string, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(token),
        expires: new Date(Date.now() + ttlMs),
      },
    }),
  ]);
  return token;
}

export type TokenStatus = "valid" | "invalid" | "expired";

/** Looks a raw token up without spending it. */
export async function checkToken(identifier: string, token: string): Promise<TokenStatus> {
  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: hashToken(token) } },
    select: { expires: true },
  });
  if (!record) {
    return "invalid";
  }
  return record.expires.getTime() < Date.now() ? "expired" : "valid";
}

export function deleteTokens(identifier: string) {
  return prisma.verificationToken.deleteMany({ where: { identifier } });
}
