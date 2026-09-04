"use server"

import type { SubmissionKind } from "@/generated/prisma/client"
import { escapeHtml, notifyAdmin } from "@/utils/notifyAdmin"
import { prisma } from "@/utils/prisma"

export type ContributionInput = {
  kind: SubmissionKind
  // the pin's public slug, not its uuid — the client only ever knows a pin by its slug. Absent
  // for a NEW_PIN, which is a request for a place that isn't on the map yet
  pinSlug?: string | null
  file?: { url: string; fileName: string; mimeType: string | null } | null
  caption?: string | null
  message?: string | null
  title?: string | null
  coord?: { latitude: number; longitude: number } | null
  // true when a PANORAMA came from the in-app spherical capture flow rather than a plain
  // uploaded file, see Submission.spherical
  spherical?: boolean
}

const KIND_SUBJECT: Record<SubmissionKind, string> = {
  ATTACHMENT: "New file",
  PANORAMA: "New panorama",
  NEW_PIN: "New place suggested",
  PIN_EDIT: "Correction suggested",
}

// public — anyone on the map can contribute, no auth required. Everything lands as a PENDING
// Submission the admin reviews at /admin/submissions. Any file is already sitting in Cloudinary
// by the time this runs (the dialog uploads it client-side first, via
// src/app/api/contribute/upload, to stay under the 4.5mb body limit a server action would hit)
export async function submitContribution(input: ContributionInput) {
  // Submission.pinId points at the pin's real (and immutable) uuid, so the slug has to be
  // resolved before the row can be written
  const pin = input.pinSlug
    ? await prisma.pin.findUniqueOrThrow({
        where: { id: input.pinSlug },
        select: { uuid: true, title: true },
      })
    : null

  await prisma.submission.create({
    data: {
      kind: input.kind,
      pinId: pin?.uuid ?? null,
      fileUrl: input.file?.url ?? null,
      fileName: input.file?.fileName ?? null,
      mimeType: input.file?.mimeType ?? null,
      caption: input.caption ?? null,
      message: input.message ?? null,
      title: input.title ?? null,
      latitude: input.coord?.latitude ?? null,
      longitude: input.coord?.longitude ?? null,
      spherical: input.spherical ?? false,
    },
  })

  const subject = `${KIND_SUBJECT[input.kind]}${pin ? ` for ${pin.title}` : ""}`
  const lines = [
    input.title && `<p><strong>${escapeHtml(input.title)}</strong></p>`,
    input.file &&
      `<p>File: <a href="${input.file.url}">${escapeHtml(input.file.fileName)}</a></p>`,
    input.message && `<p>${escapeHtml(input.message)}</p>`,
    input.caption && `<p>${escapeHtml(input.caption)}</p>`,
    input.coord && `<p>${input.coord.latitude}, ${input.coord.longitude}</p>`,
  ].filter(Boolean)

  await notifyAdmin(subject, lines.join(""))
}
