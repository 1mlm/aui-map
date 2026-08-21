import { tagRowToMapItemTag } from "@/map/mapItemFromDb"
import { type MapItemTag, parsePinLinks } from "@/map/types"
import { prisma } from "@/utils/prisma"
import type { AdminPin } from "./PinDialog"
import { PinsTable } from "./PinsTable"

export default async function AdminPinsPage() {
  const [pinRows, tagRows] = await Promise.all([
    prisma.pin.findMany({
      include: {
        attachments: { orderBy: [{ isThumbnail: "desc" }, { order: "asc" }] },
      },
      orderBy: { title: "asc" },
    }),
    prisma.tag.findMany({ orderBy: { label: "asc" } }),
  ])

  const tags: MapItemTag[] = tagRows.map(tagRowToMapItemTag)

  const pins: AdminPin[] = pinRows.map((pin) => ({
    id: pin.id,
    title: pin.title,
    aliases: pin.aliases,
    description: pin.description,
    latitude: pin.latitude,
    longitude: pin.longitude,
    mapsUrl: pin.mapsUrl,
    hours: pin.hours,
    ramadanHours: pin.ramadanHours,
    phone: pin.phone,
    email: pin.email,
    links: parsePinLinks(pin.links),
    tagId: pin.tagId,
    underConstruction: pin.underConstruction,
    attachments: pin.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      caption: attachment.caption,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      isThumbnail: attachment.isThumbnail,
      order: attachment.order,
      postedAt: attachment.postedAt.toISOString(),
    })),
  }))

  return <PinsTable {...{ pins, tags }} />
}
