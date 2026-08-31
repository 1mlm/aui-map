"use server"

import { del, put } from "@vercel/blob"
import { revalidatePath } from "next/cache"
import sharp from "sharp"
import { prisma } from "@/utils/prisma"
import { requireAuth } from "@/utils/requireAuth"

// straight off a phone a panorama is 8000px wide and 10-20mb, which is far too much to hand a
// visitor on a map that's mostly viewed on mobile data. The full file is still big enough to pan
// around in, the thumbnail is what the map marker actually loads
const FULL_MAX_WIDTH_PX = 4000
const THUMBNAIL_MAX_WIDTH_PX = 160
const FULL_QUALITY = 80
const THUMBNAIL_QUALITY = 70

async function toWebp(source: Buffer, maxWidth: number, quality: number) {
  return sharp(source)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer()
}

// the raw upload lands in Blob storage client-side first (panoramas are far past the 4.5mb body
// limit a server action accepts), so this takes the url it landed at, compresses both sizes from
// it, and drops the original — nothing keeps a 20mb file around once the webp exists
export async function createPanorama({
  rawUrl,
  latitude,
  longitude,
  caption,
  heading,
}: {
  rawUrl: string
  latitude: number
  longitude: number
  caption: string | null
  heading: number | null
}) {
  await requireAuth()

  const response = await fetch(rawUrl)
  if (!response.ok) return { error: "Couldn't read the uploaded file." }
  const original = Buffer.from(await response.arrayBuffer())

  const [full, thumbnail] = await Promise.all([
    toWebp(original, FULL_MAX_WIDTH_PX, FULL_QUALITY),
    toWebp(original, THUMBNAIL_MAX_WIDTH_PX, THUMBNAIL_QUALITY),
  ])

  const stem = `aui-map/panorama-${crypto.randomUUID()}`
  const [fullBlob, thumbnailBlob] = await Promise.all([
    put(`${stem}.webp`, full, { access: "public", contentType: "image/webp" }),
    put(`${stem}-thumb.webp`, thumbnail, {
      access: "public",
      contentType: "image/webp",
    }),
  ])
  await del(rawUrl)

  await prisma.panorama.create({
    data: {
      url: fullBlob.url,
      thumbnailUrl: thumbnailBlob.url,
      latitude,
      longitude,
      caption,
      heading,
    },
  })

  revalidatePath("/")
  revalidatePath("/admin/panoramas")
  return { error: null }
}

export async function movePanorama(
  uuid: string,
  latitude: number,
  longitude: number,
) {
  await requireAuth()
  await prisma.panorama.update({
    where: { uuid },
    data: { latitude, longitude },
  })
  revalidatePath("/")
  revalidatePath("/admin/panoramas")
  return { error: null }
}

// deletes the blobs too — unlike a pin's attachments, a panorama's files exist for nothing else,
// so leaving them behind would just be storage nobody can reach
export async function deletePanorama(uuid: string) {
  await requireAuth()
  const panorama = await prisma.panorama.findUniqueOrThrow({ where: { uuid } })
  await prisma.panorama.delete({ where: { uuid } })
  await del([panorama.url, panorama.thumbnailUrl])
  revalidatePath("/")
  revalidatePath("/admin/panoramas")
  return { error: null }
}
