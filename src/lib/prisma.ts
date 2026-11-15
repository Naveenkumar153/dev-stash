import { PrismaNeon } from "@prisma/adapter-neon";

import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 has no query engine binary — every connection goes through a driver
// adapter. Neon's serverless driver is the right one for a Neon database.
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Next.js hot-reloads modules in dev, which would otherwise open a new
// connection pool on every reload. The cached client is reused only while it
// came from the current PrismaClient class: `npm run db:generate` after a
// migration recompiles the generated client into a new class, and the old
// instance doesn't know the new schema (e.g. "Unknown field" on a new column).
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClass?: typeof PrismaClient;
};

function getPrismaClient() {
  if (globalForPrisma.prisma && globalForPrisma.prismaClass === PrismaClient) {
    return globalForPrisma.prisma;
  }

  void globalForPrisma.prisma?.$disconnect();
  return createPrismaClient();
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}
