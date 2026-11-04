"use server"

import { prisma } from "@/utils/prisma"

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 60
// anyone can call this, so a bot typing random strings can't grow the table without limit: past
// this many distinct queries only already-known ones get counted
const MAX_DISTINCT_QUERIES = 3000

// fire and forget from the map, never returns an error to the client
export async function recordSearchMiss(rawQuery: string): Promise<void> {
  const query = String(rawQuery).toLowerCase().replace(/\s+/g, " ").trim()
  if (query.length < MIN_QUERY_LENGTH || query.length > MAX_QUERY_LENGTH) return

  try {
    const existing = await prisma.searchMiss.findUnique({ where: { query } })
    if (existing) {
      await prisma.searchMiss.update({
        where: { query },
        data: { count: { increment: 1 }, lastSeen: new Date() },
      })
      return
    }
    if ((await prisma.searchMiss.count()) >= MAX_DISTINCT_QUERIES) return
    await prisma.searchMiss.create({ data: { query } })
  } catch {
    // two people typing the same new query at once can race on create, losing one count is fine
  }
}
