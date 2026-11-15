import { describe, expect, it } from "vitest";

import { createCollectionSchema } from "@/lib/collection-schemas";
import { getFieldErrors } from "@/lib/action-result";

function fieldErrors(input: unknown) {
  const result = createCollectionSchema.safeParse(input);
  return result.success ? {} : getFieldErrors(result.error);
}

describe("createCollectionSchema", () => {
  it("trims the name and description", () => {
    expect(
      createCollectionSchema.parse({ name: "  React Patterns  ", description: "  Hooks  " }),
    ).toEqual({ name: "React Patterns", description: "Hooks" });
  });

  it.each([undefined, null, "", "   "])("saves a description of %j as null", (description) => {
    expect(createCollectionSchema.parse({ name: "Notes", description })).toEqual({
      name: "Notes",
      description: null,
    });
  });

  it.each([undefined, "", "   "])("requires a name (%j)", (name) => {
    expect(fieldErrors({ name, description: "" })).toEqual({ name: "Name is required" });
  });

  it("accepts a 100-character name and refuses 101", () => {
    expect(fieldErrors({ name: "a".repeat(100) })).toEqual({});
    expect(fieldErrors({ name: "a".repeat(101) })).toEqual({
      name: "Names can be up to 100 characters",
    });
  });

  it("counts the name's length after trimming", () => {
    expect(fieldErrors({ name: ` ${"a".repeat(100)} ` })).toEqual({});
  });

  it("accepts a 500-character description and refuses 501", () => {
    expect(fieldErrors({ name: "Notes", description: "a".repeat(500) })).toEqual({});
    expect(fieldErrors({ name: "Notes", description: "a".repeat(501) })).toEqual({
      description: "Descriptions can be up to 500 characters",
    });
  });
});
