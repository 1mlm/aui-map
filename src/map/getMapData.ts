import { prisma } from "@/utils/prisma"
import { pinRowToMapItem, tagRowToMapItemTag } from "./mapItemFromDb"
import type { MapItem, MapItemTag } from "./types"

// server-only: reads straight from the db, so every caller needs to be a server
// component or server action, never imported into client-side map code
export async function getMapData(): Promise<{ items: MapItem[]; tags: MapItemTag[] }> {
  const [pins, tagRows] = await Promise.all([
    prisma.pin.findMany({
      include: { tag: true, attachments: { orderBy: [{ isThumbnail: "desc" }, { order: "asc" }] } },
      orderBy: { title: "asc" },
    }),
    prisma.tag.findMany(),
  ])

  const tagById = new Map(tagRows.map((tag) => [tag.id, tagRowToMapItemTag(tag)]))
  const items = pins.map((pin) => pinRowToMapItem(pin, tagById.get(pin.tagId) ?? tagRowToMapItemTag(pin.tag)))

  // the filter bar only offers tags actually in use, same as the old MAP_FILTER_TAGS
  const usedTagIds = new Set(items.map((item) => item.tag.id))
  const tags = tagRows.filter((tag) => usedTagIds.has(tag.id)).map(tagRowToMapItemTag)

  return { items, tags }
}
