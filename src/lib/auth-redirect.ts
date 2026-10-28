export const SIGN_IN_PATH = "/sign-in";

const DEFAULT_REDIRECT = "/dashboard";

/**
 * Where to send the user after signing in. Only same-site paths are kept, so a
 * crafted `?callbackUrl=https://evil.example` (or the protocol-relative
 * `//evil.example`) falls back to the dashboard instead.
 */
export function safeCallbackUrl(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return DEFAULT_REDIRECT;
  }
  return value;
}

const SIGN_IN_ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid email or password",
  OAuthAccountNotLinked:
    "An account with this email already exists. Sign in with the method you used before.",
  AccessDenied: "Access denied",
};

/**
 * User-facing copy for a NextAuth error code - either an `AuthError.type` from
 * a failed sign-in action or the `?error=` NextAuth appends when it redirects
 * to the sign-in page.
 */
export function getSignInErrorMessage(code: string): string {
  return SIGN_IN_ERRORS[code] ?? "Sign in failed. Please try again.";
}
