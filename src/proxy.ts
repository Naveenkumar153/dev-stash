import NextAuth from "next-auth";

import authConfig from "@/auth.config";

// Built from the edge-safe config only — importing `@/auth` here would pull
// the Prisma adapter and Neon driver into the proxy.
const { auth } = NextAuth(authConfig);

export const proxy = auth((req) => {
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
