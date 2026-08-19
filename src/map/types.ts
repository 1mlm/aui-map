import type { HugeIcon } from "@/components/Icon"
import type { TagColorName } from "./tagColor"

export type MapItemTag = {
  id: string
  label: string
  icon: HugeIcon
  color?: TagColorName
}

export type MapItemAttachment = {
  id: string
  url: string
  caption: string | null
  mimeType: string | null
  fileName: string | null
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
  tag: MapItemTag
  attachments: MapItemAttachment[]
}
