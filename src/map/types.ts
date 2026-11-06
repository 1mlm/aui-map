import type { HugeIcon } from "@/components/Icon"
import type { TagColorName } from "./tagColor"

// tiny categories (restrooms, printers) are drawn smaller and only once the map is zoomed in a
// little, unless someone picks that category in the filter
export const DETAIL_PIN_SCALE = 0.6
export const DETAIL_MIN_ZOOM = 1.8
export const isDetailTag = (tag: { sizeScale: number }) =>
  tag.sizeScale <= DETAIL_PIN_SCALE

export type MapItemTag = {
  id: string
  label: string
  icon: HugeIcon
  color?: TagColorName
  // pin size multiplier — see Tag.sizeScale in prisma/schema.prisma
  sizeScale: number
  // hidden search words for every pin of this category, see Tag.keywords
  keywords: string[]
}

export type MapItemAttachment = {
  id: string
  url: string
  caption: string | null
  mimeType: string | null
  fileName: string | null
  postedAt: Date
  // where it was taken and which way the camera faced (degrees from north), all optional
  latitude: number | null
  longitude: number | null
  heading: number | null
}

// where a photo was taken, for showing on the map
export type PhotoViewPoint = {
  latitude: number
  longitude: number
  heading: number | null
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
  // hidden search words ("doctor" for the health center), never shown, see Pin.keywords
  keywords: string[]
  // only drawn once the map is zoomed in this far, null = always. See Pin.minZoom
  minZoom: number | null
  // what the place has (printer, restrooms...), ids from amenities.ts. See Pin.amenities
  amenities: string[]
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
