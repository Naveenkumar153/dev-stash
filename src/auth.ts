import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { EMAIL_NOT_VERIFIED, RATE_LIMITED } from "@/lib/auth-redirect";
import { signInSchema } from "@/lib/auth-schemas";
import { checkPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isEmailVerificationEnabled } from "@/lib/verification";

/** The password was right but the email hasn't been confirmed yet. */
export class EmailNotVerified extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED;
}

/** Too many sign-in attempts for this IP and email, or for this email alone. */
export class TooManyAttempts extends CredentialsSignin {
  code = RATE_LIMITED;
  /** Unix time in milliseconds when another attempt is allowed. */
  reset: number;

  constructor(reset: number) {
    super();
    this.reset = reset;
  }
}

const credentials = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  // Both the sign-in action and a direct POST to the credentials callback land
  // here, so one check covers both. It runs before bcrypt so blocked attempts
  // cost no hashing.
  async authorize(input, request) {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      return null;
    }

    // Per IP + email, and per email alone so rotating IPs can't keep
    // guessing at one account. Blocked by either, retry when both allow.
    const { email } = parsed.data;
    const limits = await Promise.all([
      rateLimit("signIn", `${getClientIp(request.headers)}:${email}`),
      rateLimit("signInEmail", email),
    ]);
    const blocked = limits.filter((limit) => !limit.success);
    if (blocked.length > 0) {
      throw new TooManyAttempts(Math.max(...blocked.map((limit) => limit.reset)));
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        passwordHash: true,
        emailVerified: true,
      },
    });

    // Unknown emails and OAuth-only accounts have no password to check, but
    // still pay for one bcrypt compare so timing can't reveal them.
    const valid = await checkPassword(parsed.data.password, user?.passwordHash ?? null);
    if (!user || !valid) {
      return null;
    }

    // Checked after the password so the message can't reveal which emails
    // are registered.
    if (isEmailVerificationEnabled() && !user.emailVerified) {
      throw new EmailNotVerified();
    }

    return { id: user.id, email: user.email, name: user.name, image: user.image };
  },
});

// The adapter persists users and accounts, but sessions live in a JWT so the
// edge proxy can read them without a database round trip. Credentials sign-in
// also requires the JWT strategy.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: authConfig.providers.map((provider) =>
    typeof provider !== "function" && provider.id === "credentials" ? credentials : provider,
  ),
  callbacks: {
    ...authConfig.callbacks,
    // Node-only (Prisma), so it lives here and not in the edge-safe config the
    // proxy loads. Re-reading `isPro` on every validation means a Stripe
    // webhook's change shows on the next request, without relying on
    // `trigger === "update"` from the client.
    //
    // The same lookup reads `sessionVersion`: a password reset or change bumps
    // it, and a token issued before that comes back null here, which signs that
    // session out on its next request. A fresh sign-in records the current one.
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isPro: true, sessionVersion: true },
        });
        if (dbUser && user?.id) {
          token.sessionVersion = dbUser.sessionVersion;
        } else if (dbUser && (token.sessionVersion ?? 0) !== dbUser.sessionVersion) {
          return null;
        }
        token.isPro = dbUser?.isPro ?? false;
      }

      return token;
    },
  },
});
