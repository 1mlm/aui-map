"use server"

import { escapeHtml, notifyAdmin } from "@/utils/notifyAdmin"
import { prisma } from "@/utils/prisma"

// public — anyone on the map can suggest a file for a pin, no auth required. Lands as a
// PENDING Submission the admin reviews at /admin/submissions. The file is already sitting in
// Blob storage by the time this runs (ContributeDialog uploads it client-side first, via
// src/app/api/contribute/upload, to stay under the 4.5mb body limit a server action would hit)
export async function submitContribution(
  pinSlug: string,
  blob: { url: string; fileName: string; mimeType: string | null },
  caption: string | null,
) {
  // the client only ever knows a pin by its public slug — Submission.pinId points at the pin's
  // real (and immutable) uuid, so the slug has to be resolved before the row can be written
  const pin = await prisma.pin.findUniqueOrThrow({
    where: { id: pinSlug },
    select: { uuid: true, title: true },
  })

  await prisma.submission.create({
    data: {
      pinId: pin.uuid,
      fileUrl: blob.url,
      fileName: blob.fileName,
      mimeType: blob.mimeType ?? "application/octet-stream",
      caption,
    },
  })

  await notifyAdmin(
    `New media contribution for ${pin.title}`,
    `<p>File: <a href="${blob.url}">${escapeHtml(blob.fileName)}</a></p>${caption ? `<p>${escapeHtml(caption)}</p>` : ""}`,
  )
}
