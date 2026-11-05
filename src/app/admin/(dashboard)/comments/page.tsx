import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import { CommentsTable } from "./CommentsTable"

export const metadata: Metadata = { title: "Comments" }
export const dynamic = "force-dynamic"

export default async function AdminCommentsPage() {
  const rows = await prisma.submission.findMany({
    where: { kind: "PIN_EDIT", status: "PENDING" },
    include: { pin: { select: { id: true, title: true } } },
    orderBy: { submittedAt: "desc" },
    take: 300,
  })
  return (
    <CommentsTable
      comments={rows.map((row) => ({
        id: row.id,
        pinId: row.pin?.id ?? null,
        pinTitle: row.pin?.title ?? "Deleted pin",
        message: row.message ?? "",
        sentAt: row.submittedAt.toISOString(),
      }))}
    />
  )
}
