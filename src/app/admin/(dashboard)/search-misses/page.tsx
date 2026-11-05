import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import { MissesTable } from "./MissesTable"

export const metadata: Metadata = { title: "Missed searches" }
export const dynamic = "force-dynamic"

export default async function AdminSearchMissesPage() {
  const rows = await prisma.searchMiss.findMany({
    orderBy: [{ count: "desc" }, { lastSeen: "desc" }],
    take: 500,
  })
  return (
    <MissesTable
      misses={rows.map((row) => ({
        query: row.query,
        count: row.count,
        firstSeen: row.firstSeen.toISOString(),
        lastSeen: row.lastSeen.toISOString(),
      }))}
    />
  )
}
