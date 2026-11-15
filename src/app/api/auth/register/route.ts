import { Prisma } from "@/generated/prisma/client";
import { errorResponse } from "@/lib/api-response";
import { registerSchema } from "@/lib/auth-schemas";
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

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return errorResponse(EMAIL_TAKEN, 409);
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
      select: { id: true, name: true, email: true },
    });

    const verificationRequired = isEmailVerificationEnabled();

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
      return errorResponse(EMAIL_TAKEN, 409);
    }
    console.error("Registration failed", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
