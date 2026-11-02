import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { consumeVerificationToken } from "@/lib/verification";

const ERROR_CODES = {
  invalid: "EmailVerificationInvalid",
  expired: "EmailVerificationExpired",
} as const;

// The link in the verification email. Every outcome lands on the sign-in page,
// which shows the matching message.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const token = searchParams.get("token");
  const target = new URL(SIGN_IN_PATH, request.url);

  if (!email || !token) {
    target.searchParams.set("error", ERROR_CODES.invalid);
    return Response.redirect(target, 303);
  }

  try {
    const result = await consumeVerificationToken(email, token);
    if (result === "verified") {
      target.searchParams.set("verified", "1");
    } else {
      target.searchParams.set("error", ERROR_CODES[result]);
    }
  } catch (error) {
    console.error("Email verification failed", error);
    target.searchParams.set("error", ERROR_CODES.invalid);
  }

  return Response.redirect(target, 303);
}
