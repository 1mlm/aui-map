"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"
import { createPanorama } from "../panoramas/actions"

// a submission becomes something real on approve only when it actually carries a file to place:
// ATTACHMENT (a file for an existing pin) becomes an Attachment, PANORAMA (a file with a
// coordinate) becomes a Panorama. A NEW_PIN or PIN_EDIT is a request in words — approving it
// means "I've read this and acted on it", the pin itself still gets created or edited by hand
export async function approveSubmission(submissionId: string) {
  await requireAuth()
  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
  })
  const { kind, pinId, fileUrl, latitude, longitude, spherical } = submission

  if (
    kind === "PANORAMA" &&
    fileUrl &&
    latitude !== null &&
    longitude !== null
  ) {
    await createPanorama({
      rawUrl: fileUrl,
      latitude,
      longitude,
      caption: submission.caption,
      heading: null,
      spherical,
    })
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    })
  } else if (pinId !== null && fileUrl !== null) {
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
      prisma.submission.update({
        where: { id: submissionId },
        data: { status: "APPROVED", reviewedAt: new Date() },
      }),
    ])
  } else {
    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "APPROVED", reviewedAt: new Date() },
    })
  }

  revalidatePath("/")
  revalidatePath("/admin/pins")
  revalidatePath("/admin/panoramas")
  revalidatePath("/admin/submissions")
}

export async function rejectSubmission(submissionId: string) {
  await requireAuth()
  await prisma.submission.update({
    where: { id: submissionId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  })
  revalidatePath("/admin/submissions")
}
