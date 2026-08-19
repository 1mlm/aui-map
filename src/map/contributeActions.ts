"use server"

import { uploadFile } from "@/utils/blob"
import { prisma } from "@/utils/prisma"

// public — anyone on the map can suggest a file for a pin, no auth required. Lands as a
// PENDING Submission the admin reviews at /admin/submissions
export async function submitContribution(pinId: string, formData: FormData) {
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("No file provided")
  const captionRaw = formData.get("caption")
  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : null

  const fileUrl = await uploadFile(file)
  await prisma.submission.create({
    data: { pinId, fileUrl, fileName: file.name, mimeType: file.type || "application/octet-stream", caption },
  })
}
