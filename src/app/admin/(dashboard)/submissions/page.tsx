import type { Metadata } from "next"
import { prisma } from "@/utils/prisma"
import type { PendingSubmission } from "./SubmissionsQueue"
import { SubmissionsQueue } from "./SubmissionsQueue"

export const metadata: Metadata = { title: "Submissions" }

export default async function AdminSubmissionsPage() {
  const submissionRows = await prisma.submission.findMany({
    where: { status: "PENDING" },
    include: { pin: { select: { title: true } } },
    orderBy: { submittedAt: "asc" },
  })

  const submissions: PendingSubmission[] = submissionRows.map((submission) => ({
    id: submission.id,
    kind: submission.kind,
    fileUrl: submission.fileUrl,
    fileName: submission.fileName,
    mimeType: submission.mimeType,
    caption: submission.caption,
    message: submission.message,
    title: submission.title,
    latitude: submission.latitude,
    longitude: submission.longitude,
    pinId: submission.pinId,
    pinTitle: submission.pin?.title ?? null,
    submittedAt: submission.submittedAt.toISOString(),
  }))

  return <SubmissionsQueue {...{ submissions }} />
}
