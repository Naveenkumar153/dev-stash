"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";

import { signIn, signOut, TooManyAttempts } from "@/auth";
import {
  EMAIL_NOT_VERIFIED,
  getSignInErrorMessage,
  PASSWORD_RESET_ERRORS,
  safeCallbackUrl,
  SIGN_IN_PATH,
} from "@/lib/auth-redirect";
import {
  emailSchema,
  getFieldErrors,
  resetPasswordSchema,
  signInSchema,
  type FieldErrors,
} from "@/lib/auth-schemas";
import { issuePasswordResetEmail, resetPasswordWithToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  getRateLimitMessage,
  rateLimit,
  type RateLimitName,
} from "@/lib/rate-limit";
import { isEmailVerificationEnabled, issueVerificationEmail } from "@/lib/verification";

/**
 * Counts an attempt against `name` for the caller's IP, plus the email when
 * given. Returns the message to show when the limit is reached.
 */
async function checkRateLimit(name: RateLimitName, email?: string): Promise<string | null> {
  const ip = getClientIp(await headers());
  const { success, reset } = await rateLimit(name, email ? `${ip}:${email}` : ip);
  return success ? null : getRateLimitMessage(reset);
}

export interface SignInState {
  success: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
  /** Set when the password was right but the email is unverified, to offer a resend. */
  unverifiedEmail?: string;
  /** Shown as a toast rather than inline. */
  rateLimitError?: string;
}

export async function signInWithCredentials(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: null, fieldErrors: getFieldErrors(parsed.error) };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof TooManyAttempts) {
      return {
        success: false,
        error: null,
        fieldErrors: {},
        rateLimitError: getRateLimitMessage(error.reset),
      };
    }
    if (error instanceof CredentialsSignin && error.code === EMAIL_NOT_VERIFIED) {
      return {
        success: false,
        error: getSignInErrorMessage(EMAIL_NOT_VERIFIED),
        fieldErrors: {},
        unverifiedEmail: parsed.data.email,
      };
    }
    if (error instanceof AuthError) {
      return { success: false, error: getSignInErrorMessage(error.type), fieldErrors: {} };
    }
    // A successful sign-in redirects by throwing; let Next.js handle it.
    throw error;
  }

  return { success: true, error: null, fieldErrors: {} };
}

export interface ResendVerificationResult {
  success: boolean;
  data: null;
  error: string | null;
}

/**
 * Sends a fresh verification link. Unknown, OAuth-only and already-verified
 * emails get the same success reply, so this can't be used to probe accounts.
 */
export async function resendVerificationEmail(
  rawEmail: string,
): Promise<ResendVerificationResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { success: false, data: null, error: parsed.error.issues[0].message };
  }
  if (!isEmailVerificationEnabled()) {
    return { success: true, data: null, error: null };
  }

  const rateLimitError = await checkRateLimit("resendVerification", parsed.data);
  if (rateLimitError) {
    return { success: false, data: null, error: rateLimitError };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data },
      select: { name: true, passwordHash: true, emailVerified: true },
    });
    if (user?.passwordHash && !user.emailVerified) {
      const sent = await issueVerificationEmail(parsed.data, user.name);
      if (!sent) {
        return {
          success: false,
          data: null,
          error: "An email was just sent. Wait a minute before requesting another.",
        };
      }
    }
    return { success: true, data: null, error: null };
  } catch (error) {
    console.error("Resending verification email failed", error);
    return { success: false, data: null, error: "Could not send the email. Please try again." };
  }
}

export interface ForgotPasswordState {
  success: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
  /** The address the link was sent to, shown on the confirmation panel. */
  email?: string;
  /** Shown as a toast rather than inline. */
  rateLimitError?: string;
}

/**
 * Emails a reset link to credentials accounts. Every valid email gets the same
 * success reply - unknown, OAuth-only, inside the resend cooldown or failed to
 * send - so neither the reply nor a second request can probe accounts.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { success: false, error: null, fieldErrors: { email: parsed.error.issues[0].message } };
  }

  // Keyed by IP only, so a blocked reply says nothing about the email.
  const rateLimitError = await checkRateLimit("forgotPassword");
  if (rateLimitError) {
    return { success: false, error: null, fieldErrors: {}, rateLimitError };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data },
      select: { name: true, passwordHash: true },
    });
    if (user?.passwordHash) {
      await issuePasswordResetEmail(parsed.data, user.name);
    }
  } catch (error) {
    console.error("Sending password reset email failed", error);
  }

  return { success: true, error: null, fieldErrors: {}, email: parsed.data };
}

export interface ResetPasswordState {
  error: string | null;
  fieldErrors: FieldErrors;
  /** Set when the link itself is unusable, to offer a fresh one. */
  linkFailed?: boolean;
  /** Shown as a toast rather than inline. */
  rateLimitError?: string;
}

export async function resetPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = getFieldErrors(parsed.error);
    if (fieldErrors.email || fieldErrors.token) {
      return { error: PASSWORD_RESET_ERRORS.invalid, fieldErrors: {}, linkFailed: true };
    }
    return { error: null, fieldErrors };
  }

  const rateLimitError = await checkRateLimit("resetPassword");
  if (rateLimitError) {
    return { error: null, fieldErrors: {}, rateLimitError };
  }

  const { email, token, password } = parsed.data;
  try {
    const result = await resetPasswordWithToken(email, token, password);
    if (result !== "reset") {
      return { error: PASSWORD_RESET_ERRORS[result], fieldErrors: {}, linkFailed: true };
    }
  } catch (error) {
    console.error("Resetting password failed", error);
    return { error: "Could not reset your password. Please try again.", fieldErrors: {} };
  }

  redirect(`${SIGN_IN_PATH}?reset=1`);
}

export async function signInWithGitHub(callbackUrl: string) {
  await signIn("github", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function signOutUser() {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
