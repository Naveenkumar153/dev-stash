import { describe, expect, it } from "vitest";
import { z } from "zod";

import { getFieldErrors } from "@/lib/action-result";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(3, "Name is too long"),
  email: z.email("Enter a valid email address"),
});

function errorsFor(input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (result.success) {
    throw new Error("Expected the input to be rejected");
  }
  return getFieldErrors(result.error);
}

describe("getFieldErrors", () => {
  it("keys each message by its field", () => {
    expect(errorsFor({ name: "Ada Lovelace", email: "bad" })).toEqual({
      name: "Name is too long",
      email: "Enter a valid email address",
    });
  });

  it("keeps only the first message for a field with several", () => {
    const multi = z.object({
      password: z.string().min(8, "Too short").regex(/\d/, "Needs a number"),
    });
    const result = multi.safeParse({ password: "abc" });

    expect(result.success).toBe(false);
    expect(getFieldErrors(result.error!)).toEqual({ password: "Too short" });
  });

  it("leaves out fields that passed", () => {
    expect(errorsFor({ name: "Ada", email: "bad" })).toEqual({
      email: "Enter a valid email address",
    });
  });
});
