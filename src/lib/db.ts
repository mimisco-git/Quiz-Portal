import { PrismaClient } from "@prisma/client";

function buildPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    // Production: Turso hosted libSQL via the driver adapter
    const { createClient } = require("@libsql/client");
    const { PrismaLibSQL } = require("@prisma/adapter-libsql");

    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    });

    const adapter = new PrismaLibSQL(libsql);
    return new PrismaClient({ adapter } as any);
  }

  // Development: local SQLite file (DATABASE_URL=file:./prisma/dev.db)
  return new PrismaClient();
}

// Singleton — prevents multiple instances during dev hot-reload
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? buildPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
