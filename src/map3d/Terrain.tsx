"use client"

import { useMemo } from "react"
import * as THREE from "three"
import { MAP_METERS_SIZE } from "@/map/geo"
import { getTerrainHeightAt, TERRAIN_EXPANSION } from "./terrainHeight"

function displaceTerrain(geometry: THREE.PlaneGeometry) {
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i) // still plane-local Y (becomes world Z after rotation)
    position.setZ(i, getTerrainHeightAt(x, y))
  }
  geometry.computeVertexNormals()
  return geometry
}

export function Terrain() {
  const geometry = useMemo(() => {
    // a real margin beyond the campus box so the ground doesn't cut off right at the edge
    // buildings sit on — matches the elevation grid's own extent (see terrainHeight.ts)
    const width = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
    const depth = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
    return displaceTerrain(new THREE.PlaneGeometry(width, depth, 80, 80))
  }, [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
      <meshStandardMaterial color="#9db97e" />
    </mesh>
  )
}
