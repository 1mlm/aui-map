// where a pin's building sits in world space and which template/override applies — pulled out of
// Building.tsx so the terrain flattening pass (terrainPads.ts) can know the same footprints
// without recomputing them a second way
import { latLongToPosition } from "@/map/geo"
import type { MapItem } from "@/map/types"
import { getBuildingOverride } from "./buildingOverrides"
import { getBuildingTemplate, type BuildingTemplate } from "./buildingTemplates"
import { positionToWorldPoint } from "./worldSpace"

export function getBuildingPlacement(item: MapItem): {
  x: number
  z: number
  template: BuildingTemplate
} {
  const template = {
    ...getBuildingTemplate(item.tag.id),
    ...getBuildingOverride(item.id),
  }
  const { x, z } = positionToWorldPoint(
    latLongToPosition(item.latitude, item.longitude),
  )
  return { x, z, template }
}
