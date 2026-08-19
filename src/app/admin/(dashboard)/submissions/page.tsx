import { prisma } from "@/utils/prisma"
import type { PendingSubmission } from "./SubmissionsQueue"
import { SubmissionsQueue } from "./SubmissionsQueue"

export default async function AdminSubmissionsPage() {
  const submissionRows = await prisma.submission.findMany({
    where: { status: "PENDING" },
    include: { pin: { select: { title: true } } },
    orderBy: { submittedAt: "asc" },
  })

  const submissions: PendingSubmission[] = submissionRows.map((submission) => ({
    id: submission.id,
    fileUrl: submission.fileUrl,
    fileName: submission.fileName,
    mimeType: submission.mimeType,
    caption: submission.caption,
    pinId: submission.pinId,
    pinTitle: submission.pin.title,
    submittedAt: submission.submittedAt.toISOString(),
  }))

  return <SubmissionsQueue {...{ submissions }} />
}
