import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import { checkPassword } from "@/lib/password";

// bcrypt itself is mocked: these tests are about which hash is compared, not
// about hashing, and a real 12-round compare would slow the suite.
vi.mock("bcryptjs", () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));

describe("checkPassword", () => {
  it("compares against the stored hash", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    expect(await checkPassword("secret", "stored-hash")).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith("secret", "stored-hash");
  });

  it("is false for a wrong password", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    expect(await checkPassword("wrong", "stored-hash")).toBe(false);
  });

  it("still runs one compare, against a dummy 12-round hash, when there is no hash", async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    // Even a (theoretical) match against the dummy can't sign anyone in.
    expect(await checkPassword("anything", null)).toBe(false);
    expect(bcrypt.compare).toHaveBeenCalledOnce();
    expect(vi.mocked(bcrypt.compare).mock.calls[0][1]).toMatch(/^\$2[aby]\$12\$/);
  });
});
