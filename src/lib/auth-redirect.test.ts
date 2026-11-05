import { describe, expect, it } from "vitest";

import { getSignInErrorMessage, safeCallbackUrl } from "@/lib/auth-redirect";

describe("safeCallbackUrl", () => {
  it.each(["/dashboard", "/items/snippets", "/profile?tab=security", "/"])(
    "keeps the same-site path %s",
    (path) => {
      expect(safeCallbackUrl(path)).toBe(path);
    },
  );

  it.each([
    ["an absolute URL", "https://evil.example"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash host", "/\\evil.example"],
    ["a relative path", "dashboard"],
    ["an empty string", ""],
  ])("falls back to /dashboard for %s", (_label, value) => {
    expect(safeCallbackUrl(value)).toBe("/dashboard");
  });

  it.each([undefined, null, 42, ["/dashboard"]])(
    "falls back to /dashboard for the non-string %j",
    (value) => {
      expect(safeCallbackUrl(value)).toBe("/dashboard");
    },
  );
});

describe("getSignInErrorMessage", () => {
  it("maps a known NextAuth code to its copy", () => {
    expect(getSignInErrorMessage("CredentialsSignin")).toBe("Invalid email or password");
  });

  it("falls back to a generic message for an unknown code", () => {
    expect(getSignInErrorMessage("SomethingNew")).toBe("Sign in failed. Please try again.");
  });
});
