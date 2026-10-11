import { PrismaClient } from "@prisma/client";

// One PrismaClient per server process.
//
// In development, Next.js hot-reloads modules on every save. Without this
// globalThis trick, each reload would create a new client with its own
// connection pool, and you'd soon hit "too many connections" on Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
