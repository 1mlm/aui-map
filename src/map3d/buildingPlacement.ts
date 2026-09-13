// resolves the two kinds of 3D-map building into one shared shape (BuildingSpec) so Building.tsx,
// terrainPads.ts, and the /3d edit tools all work off one type regardless of whether a building is
// backed by a real pin or was hand-added in the editor.
import { latLongToPosition } from "@/map/geo"
import { tagPinFillColor } from "@/map/tagColor"
import type { MapItem } from "@/map/types"
import { getBuildingFootprint, isBuildingHidden } from "./buildingFootprints"
import { oklchToHex } from "./oklchToHex"
import { positionToWorldPoint } from "./worldSpace"

export type BuildingSpec = {
  id: string
  // "pin" buildings are real Pin rows -- deleting one only sets `hidden` (see
  // buildingFootprints.ts), never removes the pin. "extra" buildings are purely decorative,
  // authored entirely through the editor, and can be deleted outright.
  source: "pin" | "extra"
  x: number
  z: number
  footprint: [number, number][]
  height: number
  wallColor: string
  hidden: boolean
}

// every building is the same height for now — real per-building height is future work (see the
// 3D map backlog entry), the footprint *shape* is the real thing this pass gets right
const UNIFORM_BUILDING_HEIGHT_METERS = 8

// parking lots and sports fields aren't buildings — they're ground, not a volume, so they still
// get a real traced footprint but stay flat rather than extruding into dark 8m monoliths
const GROUND_FEATURE_TAG_IDS = new Set(["parking", "sports"])
const GROUND_FEATURE_HEIGHT_METERS = 0.3

export const DEFAULT_NEW_BUILDING_FOOTPRINT: [number, number][] = [
  [-4, -4],
  [4, -4],
  [4, 4],
  [-4, 4],
]
export const DEFAULT_NEW_BUILDING_HEIGHT = UNIFORM_BUILDING_HEIGHT_METERS
// a warm neutral, deliberately distinct from every tag color so a hand-added building always
// reads as "not a real pin" at a glance
export const DEFAULT_NEW_BUILDING_COLOR = "#c9b896"

export function pinToBuildingSpec(item: MapItem): BuildingSpec {
  const { x, z } = positionToWorldPoint(
    latLongToPosition(item.latitude, item.longitude),
  )
  const height = GROUND_FEATURE_TAG_IDS.has(item.tag.id)
    ? GROUND_FEATURE_HEIGHT_METERS
    : UNIFORM_BUILDING_HEIGHT_METERS
  return {
    id: item.id,
    source: "pin",
    x,
    z,
    footprint: getBuildingFootprint(item.id),
    height,
    // crayon-soft rather than the raw tag color (tagColor.ts) — full-saturation tailwind hues
    // read fine as tiny pins but look garish across a whole building; this is the same softened
    // tone the 2D pins already use
    wallColor: oklchToHex(tagPinFillColor(item.tag.color)),
    hidden: isBuildingHidden(item.id),
  }
}
