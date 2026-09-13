// buildings with no backing pin -- purely decorative, entirely authored through the /3d editor
// (scenery like a plaza, a landscaping block, a building nobody's made a pin for yet). Stored
// separately from buildingFootprints.json since there's no pin id to key off of and, unlike a
// pin's footprint, the whole record can be deleted outright -- see buildingPlacement.ts's
// BuildingSpec.source for why pin-linked buildings can't.
import extraBuildingsData from "./extraBuildings.json"
import {
  type BuildingSpec,
  DEFAULT_NEW_BUILDING_COLOR,
} from "./buildingPlacement"

export type ExtraBuildingRecord = {
  id: string
  x: number
  z: number
  footprint: [number, number][]
  height: number
  color?: string
}

export function getExtraBuildingSpecs(): BuildingSpec[] {
  return (extraBuildingsData as ExtraBuildingRecord[]).map((building) => ({
    id: building.id,
    source: "extra",
    x: building.x,
    z: building.z,
    footprint: building.footprint,
    height: building.height,
    wallColor: building.color ?? DEFAULT_NEW_BUILDING_COLOR,
    hidden: false,
  }))
}

export function buildingSpecToExtraRecord(
  spec: BuildingSpec,
): ExtraBuildingRecord {
  return {
    id: spec.id,
    x: spec.x,
    z: spec.z,
    footprint: spec.footprint,
    height: spec.height,
    color: spec.wallColor,
  }
}
