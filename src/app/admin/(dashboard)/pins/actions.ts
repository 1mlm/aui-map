"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@/generated/prisma/client"
import type { PinLink } from "@/map/types"
import { deleteFile, uploadFile } from "@/utils/blob"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

export type PinInput = {
  // null for a pin that doesn't exist yet — upsertPin creates one and lets the db generate its
  // uuid. Once a pin exists, its uuid is its real identity: id is just the editable public slug
  uuid: string | null
  id: string
  title: string
  aliases: string[]
  description: string | null
  latitude: number
  longitude: number
  mapsUrl: string | null
  hours: string | null
  ramadanHours: string | null
  phone: string | null
  email: string | null
  links: PinLink[]
  tagId: string
  underConstruction: boolean
}

async function getAttachments(pinId: string) {
  const attachments = await prisma.attachment.findMany({
    where: { pinId },
    orderBy: [{ isThumbnail: "desc" }, { order: "asc" }],
    select: {
      id: true,
      url: true,
      caption: true,
      mimeType: true,
      fileName: true,
      isThumbnail: true,
      order: true,
      postedAt: true,
    },
  })
  return attachments.map((attachment) => ({
    ...attachment,
    postedAt: attachment.postedAt.toISOString(),
  }))
}

// admin-pasted, so these flow straight into an href/window.open — reject anything that isn't
// plain https (a javascript: url here would execute in the visitor's session on click)
function assertValidHttpsUrl(url: string, label: string) {
  const isHttps = URL.canParse(url) && new URL(url).protocol === "https:"
  if (!isHttps) throw new Error(`${label} must be a valid https:// url.`)
}

export async function upsertPin(input: PinInput) {
  await requireAuth()
  if (input.mapsUrl) assertValidHttpsUrl(input.mapsUrl, "Maps link")
  for (const link of input.links)
    assertValidHttpsUrl(link.url, `"${link.label}" link`)
  const shared = {
    id: input.id,
    title: input.title,
    aliases: input.aliases,
    description: input.description,
    latitude: input.latitude,
    longitude: input.longitude,
    mapsUrl: input.mapsUrl,
    hours: input.hours,
    ramadanHours: input.ramadanHours,
    phone: input.phone,
    email: input.email,
    links: input.links,
    tagId: input.tagId,
    underConstruction: input.underConstruction,
  }
  try {
    if (input.uuid) {
      await prisma.pin.update({ where: { uuid: input.uuid }, data: shared })
    } else {
      await prisma.pin.create({ data: shared })
    }
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("That id is already in use.")
    }
    throw err
  }
  revalidatePath("/")
  revalidatePath("/admin/pins")
}

export async function deletePin(uuid: string) {
  await requireAuth()
  const attachments = await prisma.attachment.findMany({
    where: { pinId: uuid },
    select: { url: true },
  })
  await prisma.pin.delete({ where: { uuid } })
  await Promise.all(attachments.map((attachment) => deleteFile(attachment.url)))
  revalidatePath("/")
  revalidatePath("/admin/pins")
}

export async function setThumbnail(pinId: string, attachmentId: string) {
  await requireAuth()
  const attachment = await prisma.attachment.findUniqueOrThrow({
    where: { id: attachmentId },
  })
  if (attachment.mimeType && !attachment.mimeType.startsWith("image/")) {
    throw new Error("Only images can be set as the thumbnail.")
  }
  await prisma.$transaction([
    prisma.attachment.updateMany({
      where: { pinId },
      data: { isThumbnail: false },
    }),
    prisma.attachment.update({
      where: { id: attachmentId },
      data: { isThumbnail: true },
    }),
  ])
  revalidatePath("/")
  revalidatePath("/admin/pins")
  return getAttachments(pinId)
}

export async function setAttachmentCaption(
  pinId: string,
  attachmentId: string,
  caption: string,
) {
  await requireAuth()
  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { caption: caption || null },
  })
  revalidatePath("/")
  revalidatePath("/admin/pins")
  return getAttachments(pinId)
}

// `orderedIds` is the attachment list in its new drag order — persisted as each one's index
export async function reorderAttachments(pinId: string, orderedIds: string[]) {
  await requireAuth()
  await prisma.$transaction(
    orderedIds.map((id, order) =>
      prisma.attachment.update({ where: { id }, data: { order } }),
    ),
  )
  revalidatePath("/")
  revalidatePath("/admin/pins")
  return getAttachments(pinId)
}

export async function deleteAttachment(pinId: string, attachmentId: string) {
  await requireAuth()
  const attachment = await prisma.attachment.delete({
    where: { id: attachmentId },
  })
  await deleteFile(attachment.url)
  revalidatePath("/")
  revalidatePath("/admin/pins")
  return getAttachments(pinId)
}

export async function uploadAttachment(pinId: string, formData: FormData) {
  await requireAuth()
  const file = formData.get("file")
  if (!(file instanceof File)) throw new Error("No file provided")
  const caption = formData.get("caption")

  const url = await uploadFile(file)
  const order = await prisma.attachment.count({ where: { pinId } })
  await prisma.attachment.create({
    data: {
      pinId,
      url,
      order,
      mimeType: file.type || null,
      fileName: file.name,
      caption: typeof caption === "string" && caption ? caption : null,
    },
  })

  revalidatePath("/")
  revalidatePath("/admin/pins")
  return getAttachments(pinId)
}
