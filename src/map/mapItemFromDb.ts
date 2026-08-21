import { resolveIcon } from "./iconRegistry"
import type { TagColorName } from "./tagColor"
import { type MapItem, type MapItemTag, parsePinLinks } from "./types"

type TagRow = {
  id: string
  label: string
  icon: string
  color: string | null
  sizeScale: number
}
type PinRow = {
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
  links: unknown
  attachments: {
    id: string
    url: string
    caption: string | null
    mimeType: string | null
    fileName: string | null
    postedAt: Date
  }[]
}

// the one place a db row turns into the shapes the map/admin ui actually render —
// server-only, since it resolves icon strings via the registry
export const getShortestName = (names: string[]) =>
  names.reduce((shortest, name) =>
    name.length < shortest.length ? name : shortest,
  )

export function tagRowToMapItemTag(tag: TagRow): MapItemTag {
  return {
    id: tag.id,
    label: tag.label,
    icon: resolveIcon(tag.icon),
    color: (tag.color ?? undefined) as TagColorName | undefined,
    sizeScale: tag.sizeScale,
  }
}

export function pinRowToMapItem(pin: PinRow, tag: MapItemTag): MapItem {
  return {
    id: pin.id,
    title: pin.title,
    aliases: pin.aliases,
    shortestName: getShortestName([pin.title, ...pin.aliases]),
    description: pin.description ?? undefined,
    latitude: pin.latitude,
    longitude: pin.longitude,
    mapsUrl: pin.mapsUrl,
    hours: pin.hours,
    ramadanHours: pin.ramadanHours,
    phone: pin.phone,
    email: pin.email,
    links: parsePinLinks(pin.links),
    tag,
    attachments: pin.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      caption: attachment.caption,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
      postedAt: attachment.postedAt,
    })),
  }
}
