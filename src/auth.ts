import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { signInSchema } from "@/lib/auth-schemas";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const credentials = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(input) {
    const parsed = signInSchema.safeParse(input);
    if (!parsed.success) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, email: true, name: true, image: true, passwordHash: true },
    });

    // OAuth-only accounts have no password to check against.
    if (!user?.passwordHash) {
      return null;
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return null;
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
