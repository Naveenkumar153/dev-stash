import { Prisma } from "@/generated/prisma/client";
import { errorResponse } from "@/lib/api-response";
import { getAppUrl } from "@/lib/app-url";
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from "@/lib/auth-redirect";
import { registerSchema } from "@/lib/auth-schemas";
import { sendAccountExistsEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  getClientIp,
  getRateLimitMessage,
  getRetryAfterSeconds,
  rateLimit,
} from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-body";
import { isEmailVerificationEnabled, issueVerificationEmail } from "@/lib/verification";

const EMAIL_TAKEN = "An account with this email already exists";

/**
 * A name, an email and two passwords of at most 72 bytes fit in well under
 * this, so anything larger is refused before it is read.
 */
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: Request) {
  const body = await readJsonBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return errorResponse(body.error, body.status);
  }

  const parsed = registerSchema.safeParse(body.body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 400);
  }

  // Counted after validation, so only attempts that reach the database use
  // up the allowance.
  const limit = await rateLimit("register", getClientIp(request.headers));
  if (!limit.success) {
    return errorResponse(getRateLimitMessage(limit.reset), 429, {
      headers: { "Retry-After": String(getRetryAfterSeconds(limit.reset)) },
    });
  }

  const { name, email, password } = parsed.data;
  const verificationRequired = isEmailVerificationEnabled();
  // The same reply whether or not the email was free, while verification is
  // on: the inbox then hears which it was, not whoever sent the form.
  const checkYourEmail = () =>
    Response.json(
      { success: true, data: { name, email, verificationRequired: true }, error: null },
      { status: 201 },
    );

  try {
    // Hashed before the lookup so both paths cost the same bcrypt time.
    const passwordHash = await hashPassword(password);
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return verificationRequired ? notifyExisting(email, checkYourEmail) : emailTaken();
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { name: true, email: true },
    });

    // The account exists either way; if the email fails, the user can ask
    // for another from the check-your-email screen or the sign-in page.
    if (verificationRequired) {
      try {
        await issueVerificationEmail(user.email, user.name);
      } catch (error) {
        console.error("Verification email failed", error);
      }
    }

    return Response.json(
      { success: true, data: { ...user, verificationRequired }, error: null },
      { status: 201 },
    );
  } catch (error) {
    // Two requests for the same email can both pass the lookup above; the
    // unique constraint on `email` rejects the second.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return verificationRequired ? checkYourEmail() : emailTaken();
    }
    console.error("Registration failed", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}

/**
 * With verification off there's no inbox step to hide behind - the form signs
 * the user straight in - so a taken email has to be said plainly.
 */
function emailTaken(): Response {
  return errorResponse(EMAIL_TAKEN, 409);
}

/**
 * Tells the owner of an existing account that someone tried to register with
 * their email, at most once an hour per address, then gives the same reply as
 * a new registration. A failed send is logged, not shown, for the same reason.
 */
async function notifyExisting(email: string, reply: () => Response): Promise<Response> {
  const notice = await rateLimit("accountExistsNotice", email);
  if (notice.success) {
    const appUrl = getAppUrl();
    try {
      await sendAccountExistsEmail({
        to: email,
        signInUrl: `${appUrl}${SIGN_IN_PATH}`,
        resetUrl: `${appUrl}${FORGOT_PASSWORD_PATH}`,
      });
    } catch (error) {
      console.error("Account-exists notice failed", error);
    }
  }
  return reply();
}
