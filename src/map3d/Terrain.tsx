"use client"

import { useMemo } from "react"
import * as THREE from "three"
import { MAP_METERS_SIZE } from "@/map/geo"
import type { MapItem } from "@/map/types"
import { TERRAIN_EXPANSION } from "./terrainHeight"
import { getBuildingPads, getFlattenedTerrainHeightAt } from "./terrainPads"

function displaceTerrain(
  geometry: THREE.PlaneGeometry,
  pads: ReturnType<typeof getBuildingPads>,
) {
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i) // still plane-local Y (becomes world Z after rotation)
    position.setZ(i, getFlattenedTerrainHeightAt(x, y, pads))
  }
  geometry.computeVertexNormals()
  return geometry
}

export function Terrain({ items }: { items: MapItem[] }) {
  const geometry = useMemo(() => {
    // a real margin beyond the campus box so the ground doesn't cut off right at the edge
    // buildings sit on — matches the elevation grid's own extent (see terrainHeight.ts)
    const width = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
    const depth = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
    // dense enough that the per-building flattened pads (terrainPads.ts) actually show up as flat
    // patches instead of being averaged away between distant vertices
    const pads = getBuildingPads(items)
    return displaceTerrain(
      new THREE.PlaneGeometry(width, depth, 160, 160),
      pads,
    )
  }, [items])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshStandardMaterial color="#9db97e" />
    </mesh>
  )
}
