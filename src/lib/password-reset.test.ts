import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkToken, deleteTokens, spendToken } from "@/lib/tokens";

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: vi.fn(), user: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock("@/lib/tokens", () => ({
  checkToken: vi.fn(),
  deleteTokens: vi.fn(),
  replaceToken: vi.fn(),
  spendToken: vi.fn(),
  wasIssuedWithin: vi.fn(),
}));

const IDENTIFIER = "password-reset:ada@example.com";

function notFound() {
  return new Prisma.PrismaClientKnownRequestError("No record was found for a delete.", {
    code: "P2025",
    clientVersion: "7",
  });
}

describe("resetPasswordWithToken", () => {
  beforeEach(() => {
    vi.mocked(checkToken).mockResolvedValue("valid");
    vi.mocked(hashPassword).mockResolvedValue("new-hash");
    vi.mocked(spendToken).mockReturnValue("spend" as never);
    vi.mocked(deleteTokens).mockReturnValue("delete-rest" as never);
    vi.mocked(prisma.user.updateMany).mockReturnValue("update" as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  });

  it("spends the token first in the same transaction that sets the password", async () => {
    expect(await resetPasswordWithToken("ada@example.com", "raw-token", "new-password")).toBe("reset");

    expect(spendToken).toHaveBeenCalledWith(IDENTIFIER, "raw-token");
    const [batch] = vi.mocked(prisma.$transaction).mock.calls[0] as unknown as [unknown[]];
    expect(batch[0]).toBe("spend");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { email: "ada@example.com" },
      // The version bump signs every existing session out.
      data: { passwordHash: "new-hash", sessionVersion: { increment: 1 } },
    });
  });

  it("reads a link spent by a simultaneous submit as invalid, writing nothing", async () => {
    // The other submit deleted the token first, so this batch's delete finds no row.
    vi.mocked(prisma.$transaction).mockRejectedValue(notFound());

    expect(await resetPasswordWithToken("ada@example.com", "raw-token", "new-password")).toBe(
      "invalid",
    );
  });

  it("rethrows other database errors", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection lost"));

    await expect(
      resetPasswordWithToken("ada@example.com", "raw-token", "new-password"),
    ).rejects.toThrow("connection lost");
  });

  it("refuses an unknown token without hashing", async () => {
    vi.mocked(checkToken).mockResolvedValue("invalid");

    expect(await resetPasswordWithToken("ada@example.com", "bad", "new-password")).toBe("invalid");
    expect(hashPassword).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("clears an expired token's identifier", async () => {
    vi.mocked(checkToken).mockResolvedValue("expired");

    expect(await resetPasswordWithToken("ada@example.com", "old", "new-password")).toBe("expired");
    expect(deleteTokens).toHaveBeenCalledWith(IDENTIFIER);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
