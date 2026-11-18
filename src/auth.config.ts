import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import type { NextAuthConfig } from "next-auth";

import { SIGN_IN_PATH } from "@/lib/auth-redirect";

// Edge-safe options shared by the proxy and the full instance in `auth.ts`.
// Nothing here may touch the database — the proxy runs before Prisma is
// available, so the adapter is added only in `auth.ts`.
export default {
  // OAuth failures (e.g. `OAuthAccountNotLinked`) land on the sign-in page with
  // `?error=` rather than on NextAuth's default error page.
  pages: { signIn: SIGN_IN_PATH, error: SIGN_IN_PATH },
  providers: [
    GitHub,
    // Placeholder so the proxy knows the provider exists; `auth.ts` swaps in
    // the real `authorize`, which needs Prisma and bcrypt.
    Credentials({ authorize: () => null }),
  ],
  callbacks: {
    // With the JWT strategy `token.sub` is the database user id, set on
    // sign-in from the adapter's user row. `token.isPro` is re-read by the
    // `jwt` callback in `auth.ts`. The proxy doesn't run that callback, so its
    // copy is whatever the cookie last held and may be stale: gate on
    // `getSessionEntitlements()` server-side, never in the proxy.
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      session.user.isPro = token.isPro === true;
      return session;
    },
  },
} satisfies NextAuthConfig;
