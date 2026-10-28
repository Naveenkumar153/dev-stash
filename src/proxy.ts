import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";

// Built from the edge-safe config only — importing `@/auth` here would pull
// the Prisma adapter and Neon driver into the proxy.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL(SIGN_IN_PATH, req.nextUrl.origin);
    // A path rather than the full URL, which `safeCallbackUrl()` would reject.
    signInUrl.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
