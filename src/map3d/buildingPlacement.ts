// where a pin's building sits in world space and its footprint polygon — pulled out of
// Building.tsx so the terrain flattening pass (terrainPads.ts) can know the same footprints
// without recomputing them a second way
import { latLongToPosition } from "@/map/geo"
import type { MapItem } from "@/map/types"
import { getBuildingFootprint } from "./buildingFootprints"
import { positionToWorldPoint } from "./worldSpace"

export function getBuildingPlacement(item: MapItem): {
  x: number
  z: number
  footprint: [number, number][]
} {
  const { x, z } = positionToWorldPoint(
    latLongToPosition(item.latitude, item.longitude),
  )
  return { x, z, footprint: getBuildingFootprint(item.id) }
}
