import { describe, expect, it, vi } from "vitest";

import { getAppUrl } from "@/lib/app-url";

describe("getAppUrl", () => {
  it("falls back to the local dev server", () => {
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("uses AUTH_URL without trailing slashes", () => {
    vi.stubEnv("AUTH_URL", "https://devstash.io//");
    expect(getAppUrl()).toBe("https://devstash.io");
  });
});
