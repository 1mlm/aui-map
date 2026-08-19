"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export async function approveSubmission(submissionId: string) {
  await requireAuth()
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })

  const order = await prisma.attachment.count({ where: { pinId: submission.pinId } })
  await prisma.$transaction([
    prisma.attachment.create({
      data: {
        pinId: submission.pinId,
        url: submission.fileUrl,
        caption: submission.caption,
        mimeType: submission.mimeType,
        fileName: submission.fileName,
        order,
      },
    }),
    prisma.submission.update({ where: { id: submissionId }, data: { status: "APPROVED", reviewedAt: new Date() } }),
  ])

  revalidatePath("/")
  revalidatePath("/admin/pins")
  revalidatePath("/admin/submissions")
}

export async function rejectSubmission(submissionId: string) {
  await requireAuth()
  await prisma.submission.update({ where: { id: submissionId }, data: { status: "REJECTED", reviewedAt: new Date() } })
  revalidatePath("/admin/submissions")
}
