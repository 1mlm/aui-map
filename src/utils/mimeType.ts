import type { HugeIcon } from "@/components/Icon"
import { ICONS } from "@/icons"

// null mimeType only ever shows up on attachments created before file-type
// support existed — all of those are images, so treat null as image/*
export const isImageMimeType = (mimeType: string | null) => mimeType == null || mimeType.startsWith("image/")

export const isVideoMimeType = (mimeType: string | null) => mimeType?.startsWith("video/") ?? false

export function iconForMimeType(mimeType: string | null): HugeIcon {
  if (isImageMimeType(mimeType)) return ICONS.photo
  if (isVideoMimeType(mimeType)) return ICONS.video
  if (mimeType === "application/pdf") return ICONS.pdf
  if (mimeType === "text/csv") return ICONS.csv
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return ICONS.spreadsheet
  return ICONS.fileGeneric
}
