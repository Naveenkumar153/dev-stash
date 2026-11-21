import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  AI_PRO_REQUIRED,
  AI_UNAVAILABLE,
  COLLECTION_LIMIT_REACHED,
  ITEM_CREATE_FAILED,
  ITEM_LIMIT_REACHED,
  PRO_REQUIRED,
  actionFailure,
  formFailure,
  getFieldErrors,
  isUpgradeError,
  runOwnedWrite,
  validationFailure,
} from "@/lib/action-result";

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

describe("isUpgradeError", () => {
  it.each([ITEM_LIMIT_REACHED, COLLECTION_LIMIT_REACHED, PRO_REQUIRED, AI_PRO_REQUIRED])(
    "is true for %j",
    (error) => {
      expect(isUpgradeError(error)).toBe(true);
    },
  );

  it("is false for other errors and none", () => {
    expect(isUpgradeError(ITEM_CREATE_FAILED)).toBe(false);
    expect(isUpgradeError(AI_UNAVAILABLE)).toBe(false);
    expect(isUpgradeError(null)).toBe(false);
  });

  it("names the Free limits in the limit messages", () => {
    expect(ITEM_LIMIT_REACHED).toContain("limit of 50 items");
    expect(COLLECTION_LIMIT_REACHED).toContain("limit of 3 collections");
  });
});

describe("failure replies", () => {
  it("actionFailure carries only the error", () => {
    expect(actionFailure("Nope")).toEqual({ success: false, data: null, error: "Nope" });
  });

  it("formFailure defaults to no field errors", () => {
    expect(formFailure("Nope")).toEqual({ success: false, data: null, error: "Nope", fieldErrors: {} });
  });

  it("formFailure keeps the field errors it's given", () => {
    expect(formFailure("Taken", { name: "Taken" })).toEqual({
      success: false,
      data: null,
      error: "Taken",
      fieldErrors: { name: "Taken" },
    });
  });

  it("validationFailure uses the first issue's message and each field's first error", () => {
    const parsed = schema.safeParse({ name: "", email: "nope" });
    if (parsed.success) throw new Error("expected the input to be invalid");

    expect(validationFailure(parsed.error)).toEqual({
      success: false,
      data: null,
      error: "Name is required",
      fieldErrors: { name: "Name is required", email: "Enter a valid email address" },
    });
  });
});

describe("runOwnedWrite", () => {
  const messages = { notFound: "Not found", failed: "Failed", logLabel: "Saving failed" };

  it("returns null when the write matched a row", async () => {
    await expect(runOwnedWrite(async () => true, messages)).resolves.toBeNull();
  });

  it("returns the not-found message when the write matched nothing", async () => {
    await expect(runOwnedWrite(async () => false, messages)).resolves.toBe("Not found");
  });

  it("returns the failure message and logs when the write throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("connection reset");

    await expect(
      runOwnedWrite(async () => {
        throw error;
      }, messages),
    ).resolves.toBe("Failed");
    expect(log).toHaveBeenCalledWith("Saving failed", error);
  });
});
