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
// connection pool on every reload.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
