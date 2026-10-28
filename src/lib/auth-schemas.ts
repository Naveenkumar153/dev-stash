import { z } from "zod";

// Normalized the same way on sign-up and sign-in so `Test@Example.com ` finds
// the row stored as `test@example.com`.
const email = z
  .string({ error: "Email is required" })
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

export const signInSchema = z.object({
  email,
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    email,
    // bcrypt ignores everything past 72 bytes, so a longer password would
    // silently match any string sharing its first 72.
    password: z
      .string({ error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .refine((value) => new TextEncoder().encode(value).length <= 72, "Password is too long"),
    confirmPassword: z.string({ error: "Confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, string>>;

/** The first message for each field, keyed by the field's name. */
export function getFieldErrors(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    fieldErrors[String(issue.path[0])] ??= issue.message;
  }
  return fieldErrors;
}
