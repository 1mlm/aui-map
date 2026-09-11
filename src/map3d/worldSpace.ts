// Converts the same normalized map position everything else in the app uses (see src/map/geo.ts)
// into three.js world coordinates, in real meters — so a building's meter-based footprint
// (buildingFootprints.ts) lines up with the ground it sits on without a second unit system to
// keep in sync.

import { MAP_METERS_SIZE, type NormalizedPosition } from "@/map/geo"

export type WorldPoint = { x: number; z: number }

// x/z rather than x/y: three.js treats y as "up", so the ground plane is x/z, matching how
// screenPointToPosition's x/y map onto the image today (x = east/west, the position's second
// value = north/south)
export function positionToWorldPoint([x, y]: NormalizedPosition): WorldPoint {
  return {
    x: (x - 0.5) * MAP_METERS_SIZE.widthMeters,
    z: (y - 0.5) * MAP_METERS_SIZE.heightMeters,
  }
}

// the map image's bounding box has a deliberate margin around the actual campus (see geo.ts), so
// framing the camera on the whole box leaves buildings as tiny specks in the middle of empty
// terrain — this instead frames on where the buildings actually are
export function getWorldBounds(points: WorldPoint[]) {
  const xs = points.map((point) => point.x)
  const zs = points.map((point) => point.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  return {
    center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    radius: Math.max(maxX - minX, maxZ - minZ) / 2,
  }
}
