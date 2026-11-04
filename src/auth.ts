import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { EMAIL_NOT_VERIFIED, RATE_LIMITED } from "@/lib/auth-redirect";
import { signInSchema } from "@/lib/auth-schemas";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { isEmailVerificationEnabled } from "@/lib/verification";

/** The password was right but the email hasn't been confirmed yet. */
export class EmailNotVerified extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED;
}

/** Too many sign-in attempts for this IP and email. */
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

    const ip = getClientIp(request.headers);
    const limit = await rateLimit("signIn", `${ip}:${parsed.data.email}`);
    if (!limit.success) {
      throw new TooManyAttempts(limit.reset);
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

    // OAuth-only accounts have no password to check against.
    if (!user?.passwordHash) {
      return null;
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
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
});
