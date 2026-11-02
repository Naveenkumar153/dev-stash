"use server";

import { AuthError, CredentialsSignin } from "next-auth";

import { signIn, signOut } from "@/auth";
import {
  EMAIL_NOT_VERIFIED,
  getSignInErrorMessage,
  safeCallbackUrl,
  SIGN_IN_PATH,
} from "@/lib/auth-redirect";
import {
  emailSchema,
  getFieldErrors,
  signInSchema,
  type FieldErrors,
} from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";
import { issueVerificationEmail } from "@/lib/verification";

export interface SignInState {
  success: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
  /** Set when the password was right but the email is unverified, to offer a resend. */
  unverifiedEmail?: string;
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

export async function signInWithGitHub(callbackUrl: string) {
  await signIn("github", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function signOutUser() {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
