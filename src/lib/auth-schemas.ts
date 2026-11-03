import { z } from "zod";

// Normalized the same way on sign-up and sign-in so `Test@Example.com ` finds
// the row stored as `test@example.com`.
export const emailSchema = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

// bcrypt ignores everything past 72 bytes, so a longer password would
// silently match any string sharing its first 72.
const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long");

const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) =>
    data.password === data.confirmPassword,
  params: { message: "Passwords do not match", path: ["confirmPassword"] },
};

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string({ error: "Confirm your password" }),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    token: z.string({ error: "Reset link is invalid" }).min(1, "Reset link is invalid"),
    password: passwordSchema,
    confirmPassword: z.string({ error: "Confirm your password" }),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required"),
    password: passwordSchema,
    confirmPassword: z.string({ error: "Confirm your password" }),
  })
  .refine(passwordsMatch.check, passwordsMatch.params);

export type FieldErrors = Partial<Record<string, string>>;

/** The first message for each field, keyed by the field's name. */
export function getFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    fieldErrors[String(issue.path[0])] ??= issue.message;
  }
  return fieldErrors;
}
