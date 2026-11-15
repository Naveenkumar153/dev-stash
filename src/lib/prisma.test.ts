import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The generated client and the Neon adapter are replaced with fakes, so no
// connection is made; each test imports `@/lib/prisma` fresh, as a hot reload would.
vi.mock("@prisma/adapter-neon", () => ({ PrismaNeon: vi.fn() }));

/** A stand-in for one compile of the generated `PrismaClient` class. */
function fakeClientClass() {
  return vi.fn(
    class {
      $disconnect = vi.fn().mockResolvedValue(undefined);
    },
  );
}

const globalForPrisma = globalThis as { prisma?: unknown; prismaClass?: unknown };

async function loadPrisma(PrismaClient: ReturnType<typeof fakeClientClass>) {
  vi.resetModules();
  vi.doMock("@/generated/prisma/client", () => ({ PrismaClient }));
  return (await import("@/lib/prisma")).prisma as unknown as { $disconnect: ReturnType<typeof vi.fn> };
}

describe("prisma singleton", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://test@localhost/test");
  });

  afterEach(() => {
    delete globalForPrisma.prisma;
    delete globalForPrisma.prismaClass;
  });

  it("reuses the cached client across reloads while the generated client is unchanged", async () => {
    const PrismaClient = fakeClientClass();

    const first = await loadPrisma(PrismaClient);
    const second = await loadPrisma(PrismaClient);

    expect(second).toBe(first);
    expect(PrismaClient).toHaveBeenCalledTimes(1);
    expect(first.$disconnect).not.toHaveBeenCalled();
  });

  it("builds a new client and disconnects the old one after `db:generate`", async () => {
    const before = await loadPrisma(fakeClientClass());
    const RegeneratedClient = fakeClientClass();

    const after = await loadPrisma(RegeneratedClient);

    expect(after).not.toBe(before);
    expect(after).toBeInstanceOf(RegeneratedClient);
    expect(before.$disconnect).toHaveBeenCalledOnce();
    expect(globalForPrisma.prismaClass).toBe(RegeneratedClient);
  });

  it("throws without DATABASE_URL instead of connecting nowhere", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(loadPrisma(fakeClientClass())).rejects.toThrow("DATABASE_URL is not set");
  });
});
