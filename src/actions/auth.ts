"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import {
  getSignInErrorMessage,
  safeCallbackUrl,
  SIGN_IN_PATH,
} from "@/lib/auth-redirect";
import { getFieldErrors, signInSchema, type FieldErrors } from "@/lib/auth-schemas";

export interface SignInState {
  success: boolean;
  error: string | null;
  fieldErrors: FieldErrors;
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
    if (error instanceof AuthError) {
      return { success: false, error: getSignInErrorMessage(error.type), fieldErrors: {} };
    }
    // A successful sign-in redirects by throwing; let Next.js handle it.
    throw error;
  }

  return { success: true, error: null, fieldErrors: {} };
}

export async function signInWithGitHub(callbackUrl: string) {
  await signIn("github", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function signOutUser() {
  await signOut({ redirectTo: SIGN_IN_PATH });
}
