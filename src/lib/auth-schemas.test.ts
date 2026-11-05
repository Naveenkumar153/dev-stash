import { describe, expect, it } from "vitest";

import {
  emailSchema,
  getFieldErrors,
  registerSchema,
  signInSchema,
} from "@/lib/auth-schemas";

const validRegistration = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  password: "password123",
  confirmPassword: "password123",
};

/** Field errors for an input the schema rejects. */
function errorsFor(input: Record<string, unknown>) {
  const result = registerSchema.safeParse(input);
  if (result.success) {
    throw new Error("Expected the input to be rejected");
  }
  return getFieldErrors(result.error);
}

describe("emailSchema", () => {
  it("trims and lowercases, so sign-up and sign-in look up the same row", () => {
    expect(emailSchema.parse("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects a malformed address", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("doesn't apply the sign-up password rules to sign-in", () => {
    // An account's password predates any later rule change, so sign-in only
    // requires one to be present.
    expect(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("requires a password", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts a valid registration and trims the name", () => {
    const result = registerSchema.parse({ ...validRegistration, name: "  Ada  " });

    expect(result.name).toBe("Ada");
  });

  it("requires at least 8 characters", () => {
    expect(errorsFor({ ...validRegistration, password: "short", confirmPassword: "short" }))
      .toEqual({ password: "Password must be at least 8 characters" });
  });

  it("rejects passwords over bcrypt's 72-byte limit, counting bytes not characters", () => {
    // 37 characters but 74 UTF-8 bytes: bcrypt would ignore the last two.
    const password = "é".repeat(37);

    expect(errorsFor({ ...validRegistration, password, confirmPassword: password }))
      .toEqual({ password: "Password is too long" });
  });

  it("accepts a password of exactly 72 bytes", () => {
    const password = "a".repeat(72);

    expect(
      registerSchema.safeParse({ ...validRegistration, password, confirmPassword: password })
        .success,
    ).toBe(true);
  });

  it("reports a mismatched confirmation on confirmPassword", () => {
    expect(errorsFor({ ...validRegistration, confirmPassword: "password124" }))
      .toEqual({ confirmPassword: "Passwords do not match" });
  });
});

describe("getFieldErrors", () => {
  it("keeps only the first message for each field", () => {
    const errors = errorsFor({ name: "", email: "bad", password: "", confirmPassword: "" });

    expect(errors).toEqual({
      name: "Name is required",
      email: "Enter a valid email address",
      password: "Password must be at least 8 characters",
    });
  });
});
