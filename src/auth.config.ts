import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

// Edge-safe options shared by the proxy and the full instance in `auth.ts`.
// Nothing here may touch the database — the proxy runs before Prisma is
// available, so the adapter is added only in `auth.ts`.
export default {
  providers: [
    GitHub,
    // Placeholder so the proxy knows the provider exists; `auth.ts` swaps in
    // the real `authorize`, which needs Prisma and bcrypt.
    Credentials({ authorize: () => null }),
  ],
  callbacks: {
    // With the JWT strategy `token.sub` is the database user id, set on
    // sign-in from the adapter's user row.
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
