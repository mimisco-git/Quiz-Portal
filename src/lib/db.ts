import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

function buildPrismaClient(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const adapter = new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    });
    return new PrismaClient({ adapter } as any);
  }

  // Local dev: SQLite file via DATABASE_URL=file:./prisma/dev.db
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? buildPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
