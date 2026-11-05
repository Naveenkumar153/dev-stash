import { describe, expect, it, vi } from "vitest";

import { isEmailVerificationEnabled } from "@/lib/verification";

// verification.ts imports the Prisma client, which would throw at import
// without DATABASE_URL. Only the flag is tested here, so an empty stand-in
// is enough.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("isEmailVerificationEnabled", () => {
  it("is on when the variable is unset", () => {
    expect(isEmailVerificationEnabled()).toBe(true);
  });

  it("is off only for the exact string 'false'", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENABLED", "false");

    expect(isEmailVerificationEnabled()).toBe(false);
  });

  it.each(["true", "False", "FALSE", " false", "0", "no", ""])(
    "stays on for %j, so a typo can't switch verification off",
    (value) => {
      vi.stubEnv("EMAIL_VERIFICATION_ENABLED", value);

      expect(isEmailVerificationEnabled()).toBe(true);
    },
  );
});
