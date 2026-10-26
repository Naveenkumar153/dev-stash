import { Prisma } from "@/generated/prisma/client";
import { registerSchema } from "@/lib/auth-schemas";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const EMAIL_TAKEN = "An account with this email already exists";

function errorResponse(error: string, status: number) {
  return Response.json({ success: false, data: null, error }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0].message, 400);
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

    return Response.json({ success: true, data: user, error: null }, { status: 201 });
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
