"use server"

import { uploadFile } from "@/utils/blob"
import { prisma } from "@/utils/prisma"

// public — anyone on the map can suggest a file for a pin, no auth required. Lands as a
// PENDING Submission the admin reviews at /admin/submissions
export async function submitContribution(pinSlug: string, formData: FormData) {
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("No file provided")
  const captionRaw = formData.get("caption")
  const caption =
    typeof captionRaw === "string" && captionRaw.trim()
      ? captionRaw.trim()
      : null

  // the client only ever knows a pin by its public slug — Submission.pinId points at the pin's
  // real (and immutable) uuid, so the slug has to be resolved before the row can be written
  const pin = await prisma.pin.findUniqueOrThrow({
    where: { id: pinSlug },
    select: { uuid: true },
  })

  const fileUrl = await uploadFile(file)
  await prisma.submission.create({
    data: {
      pinId: pin.uuid,
      fileUrl,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      caption,
    },
  })
}
