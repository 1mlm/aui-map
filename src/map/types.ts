import type { HugeIcon } from "@/components/Icon"
import type { TagColorName } from "./tagColor"

export type MapItemTag = {
  id: string
  label: string
  icon: HugeIcon
  color?: TagColorName
  // pin size multiplier — see Tag.sizeScale in prisma/schema.prisma
  sizeScale: number
}

export type MapItemAttachment = {
  id: string
  url: string
  caption: string | null
  mimeType: string | null
  fileName: string | null
  postedAt: Date
}

export type PinLink = { label: string; url: string }

function isPinLink(value: unknown): value is PinLink {
  if (typeof value !== "object" || value === null) return false
  const { label, url } = value as Record<string, unknown>
  return typeof label === "string" && typeof url === "string"
}

// Pin.links is a Postgres Json column — defensive parsing here rather than trusting the db's
// JsonValue shape, since nothing stops a stray write from putting something malformed in it
export function parsePinLinks(value: unknown): PinLink[] {
  return Array.isArray(value) ? value.filter(isPinLink) : []
}

export type MapItem = {
  id: string
  title: string
  aliases: string[]
  shortestName: string
  description?: string
  latitude: number
  longitude: number
  // curated place link override for the maps menu's Google Maps option — see Pin.mapsUrl
  mapsUrl: string | null
  // freeform, e.g. "Mon-Thu 8am-12am, Fri 8am-6pm" — see Pin.hours
  hours: string | null
  // only shown (via a small reveal) when set — most pins won't have Ramadan hours at all
  ramadanHours: string | null
  phone: string | null
  email: string | null
  links: PinLink[]
  tag: MapItemTag
  attachments: MapItemAttachment[]
  underConstruction: boolean
  updatedAt: Date
}

// a wide flat photo placed at a coordinate, with no owning pin — see Panorama in the schema
export type MapPanorama = {
  uuid: string
  url: string
  thumbnailUrl: string
  caption: string | null
  latitude: number
  longitude: number
}
