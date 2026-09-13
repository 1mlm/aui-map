"use client"

import type { ThreeEvent } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"
import { MAP_METERS_SIZE } from "@/map/geo"
import {
  TERRAIN_EXPANSION,
  TERRAIN_GRID_COLS,
  TERRAIN_GRID_ROWS,
} from "./terrainHeight"
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

export function Terrain({
  buildings,
  // the ground doubles as the drag surface for the building editor (placing a new building,
  // dragging a footprint vertex) -- both just need "where did the ray hit the ground", which the
  // terrain mesh already answers via its own pointer events, so there's no separate invisible
  // catcher plane to keep in sync with it
  onGroundClick,
  onGroundPointerMove,
}: {
  buildings: { x: number; z: number; footprint: [number, number][] }[]
  onGroundClick?: (worldX: number, worldZ: number) => void
  onGroundPointerMove?: (worldX: number, worldZ: number) => void
}) {
  const geometry = useMemo(() => {
    // a real margin beyond the campus box so the ground doesn't cut off right at the edge
    // buildings sit on — matches the elevation grid's own extent (see terrainHeight.ts)
    const width = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
    const depth = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
    // segment counts are the grid's own resolution minus one -- must match exactly (see
    // terrainHeight.ts's terrainHeightmap.json, currently a flat plane)
    const pads = getBuildingPads(buildings)
    return displaceTerrain(
      new THREE.PlaneGeometry(
        width,
        depth,
        TERRAIN_GRID_COLS - 1,
        TERRAIN_GRID_ROWS - 1,
      ),
      pads,
    )
  }, [buildings])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!onGroundClick) return
    event.stopPropagation()
    onGroundClick(event.point.x, event.point.z)
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!onGroundPointerMove) return
    onGroundPointerMove(event.point.x, event.point.z)
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
    >
      <meshStandardMaterial color="#9db97e" />
    </mesh>
  )
}
