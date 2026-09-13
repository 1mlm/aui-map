// real terrain has real slope, but buildings are flat-bottomed boxes that sit at one sampled
// height — without this, a building on any real slope has the raw sloped ground clipping through
// one side and gapping away from the other, which reads as broken rather than 3D. Each building
// gets a locally flattened "pad" (like a real graded building lot) blended into the surrounding
// slope instead of a hard step.
import { getTerrainHeightAt } from "./terrainHeight"

export type TerrainPad = {
  x: number
  z: number
  radius: number
  height: number
}

// how far past a building's own footprint the flattened pad blends back into the raw slope
const PAD_BLEND_METERS = 6

export function getBuildingPads(
  buildings: { x: number; z: number; footprint: [number, number][] }[],
): TerrainPad[] {
  return buildings.map(({ x, z, footprint }) => {
    const radius = Math.max(...footprint.map(([px, pz]) => Math.hypot(px, pz)))
    return { x, z, radius, height: getTerrainHeightAt(x, z) }
  })
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function getFlattenedTerrainHeightAt(
  x: number,
  z: number,
  pads: TerrainPad[],
): number {
  const raw = getTerrainHeightAt(x, z)
  return pads.reduce((height, pad) => {
    const distance = Math.hypot(x - pad.x, z - pad.z)
    if (distance >= pad.radius + PAD_BLEND_METERS) return height
    const influence =
      1 - smoothstep(pad.radius, pad.radius + PAD_BLEND_METERS, distance)
    return height + (pad.height - height) * influence
  }, raw)
}
