import type { MapItem } from "./types"

// the names a place is known by: what was written in the admin (blank entries dropped) plus the
// obvious spellings people type that the title itself doesn't contain. "B 8/B" is searched as
// "B8B" and "Building 8B", and Google can only match text that is on the page
export function placeNames(item: Pick<MapItem, "title" | "aliases">) {
  const names = new Set(item.aliases.map((name) => name.trim()).filter(Boolean))
  const title = item.title.trim()
  const compact = title.replace(/[\s/\-.]+/g, "")
  if (compact !== title && compact.length <= 10) names.add(compact)
  const building = title.match(/^b\s*(\d+)\s*[/-]?\s*([a-z])?$/i)
  if (building)
    names.add(`Building ${building[1]}${(building[2] ?? "").toUpperCase()}`)
  names.delete(title)
  const lowered = new Set<string>()
  return [...names].filter((name) => {
    const key = name.toLowerCase()
    if (lowered.has(key) || key === title.toLowerCase()) return false
    lowered.add(key)
    return true
  })
}
