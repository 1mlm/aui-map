"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

// only a submission that actually carries a file for an existing pin can be turned into an
// Attachment by approving it. A NEW_PIN or PIN_EDIT is a request in words — approving it means
// "I've read this and acted on it", and the pin itself still gets created or edited by hand
export async function approveSubmission(submissionId: string) {
  await requireAuth()
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
  const markReviewed = prisma.submission.update({
    where: { id: submissionId },
    data: { status: "APPROVED", reviewedAt: new Date() },
  })

  const { pinId, fileUrl } = submission
  if (pinId === null || fileUrl === null) {
    await markReviewed
  } else {
    const order = await prisma.attachment.count({ where: { pinId } })
    await prisma.$transaction([
      prisma.attachment.create({
        data: {
          url: fileUrl,
          caption: submission.caption,
          mimeType: submission.mimeType,
          fileName: submission.fileName,
          order,
          pinId,
        },
      }),
      markReviewed,
    ])
  }

  revalidatePath("/")
  revalidatePath("/admin/pins")
  revalidatePath("/admin/submissions")
}

export async function rejectSubmission(submissionId: string) {
  await requireAuth()
  await prisma.submission.update({ where: { id: submissionId }, data: { status: "REJECTED", reviewedAt: new Date() } })
  revalidatePath("/admin/submissions")
}
