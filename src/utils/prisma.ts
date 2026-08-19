import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

declare global {
  var prismaClient: PrismaClient | undefined
}

export const prisma = globalThis.prismaClient ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalThis.prismaClient = prisma
