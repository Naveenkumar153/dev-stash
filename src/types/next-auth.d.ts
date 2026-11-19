import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Re-read from the database by the `jwt` callback in `src/auth.ts`. */
      isPro: boolean;
    } & DefaultSession["user"];
  }
}

// `next-auth/jwt` re-exports `@auth/core/jwt`, and augmenting it is the
// documented route for the token's own fields.
declare module "next-auth/jwt" {
  interface JWT {
    isPro?: boolean;
    /** `User.sessionVersion` when issued; a lower value than the row's ends the session. Absent reads as 0. */
    sessionVersion?: number;
  }
}
