export const SIGN_IN_PATH = "/sign-in";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

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

/** `CredentialsSignin.code` for a correct password on an unverified email. */
export const EMAIL_NOT_VERIFIED = "email_not_verified";

/** `CredentialsSignin.code` for a sign-in blocked by the rate limit. */
export const RATE_LIMITED = "rate_limited";

const SIGN_IN_ERRORS: Record<string, string> = {
  CredentialsSignin: "Invalid email or password",
  [EMAIL_NOT_VERIFIED]: "Verify your email before signing in. Check your inbox for the link.",
  EmailVerificationInvalid: "That verification link is invalid or has already been used.",
  EmailVerificationExpired: "That verification link has expired. Sign in to get a new one.",
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

export const PASSWORD_RESET_ERRORS = {
  invalid: "That reset link is invalid or has already been used.",
  expired: "That reset link has expired.",
} as const;
