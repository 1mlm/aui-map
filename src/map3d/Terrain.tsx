"use client"

import type { ThreeEvent } from "@react-three/fiber"
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react"
import * as THREE from "three"
import { MAP_METERS_SIZE } from "@/map/geo"
import type { MapItem } from "@/map/types"
import {
  getTerrainHeights,
  TERRAIN_EXPANSION,
  TERRAIN_GRID_COLS,
  TERRAIN_GRID_ROWS,
} from "./terrainHeight"
import { getBuildingPads, getFlattenedTerrainHeightAt } from "./terrainPads"

export type TerrainHandle = {
  // the sculpt tool's own working copy, read by the Save button -- not the module-level heights
  // (that only updates once a save round-trips through a reload, see terrainHeight.ts)
  getHeights: () => number[]
}

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

// raise/lower a circular patch of the working heightmap around a plane-local (localX, localY)
// point, falling off smoothly to zero at the brush edge so strokes blend instead of leaving a
// visible flat-topped cylinder
function applyBrush(
  heights: number[],
  localX: number,
  localY: number,
  radius: number,
  delta: number,
) {
  for (let row = 0; row < TERRAIN_GRID_ROWS; row++) {
    for (let col = 0; col < TERRAIN_GRID_COLS; col++) {
      const worldWidth = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
      const worldHeight = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
      const x = (col / (TERRAIN_GRID_COLS - 1) - 0.5) * worldWidth
      const y = (row / (TERRAIN_GRID_ROWS - 1) - 0.5) * worldHeight
      const distance = Math.hypot(x - localX, y - localY)
      if (distance >= radius) continue
      const falloff = 1 - distance / radius
      heights[row * TERRAIN_GRID_COLS + col] += delta * falloff * falloff
    }
  }
}

export const Terrain = forwardRef<
  TerrainHandle,
  {
    items: MapItem[]
    // sculpt mode: drag to raise, shift-drag to lower. Off by default so the plain 3D map (and
    // every other edit tool) doesn't pay for pointer handlers it never uses
    sculptable?: boolean
    brushRadius?: number
    brushStrength?: number
    onSculptStart?: () => void
    onSculptEnd?: () => void
  }
>(function Terrain(
  {
    items,
    sculptable = false,
    brushRadius = 12,
    brushStrength = 1.5,
    onSculptStart,
    onSculptEnd,
  },
  ref,
) {
  // the sculpt tool's own mutable copy -- edits accumulate here and only reach the shared
  // module-level heights (and disk) once Save posts them, per Map3DExperience's edit flow
  const workingHeights = useRef<number[]>([...getTerrainHeights()])
  const isSculptingRef = useRef(false)
  const sculptDirectionRef = useRef<1 | -1>(1)

  useImperativeHandle(ref, () => ({ getHeights: () => workingHeights.current }))

  const geometry = useMemo(() => {
    // a real margin beyond the campus box so the ground doesn't cut off right at the edge
    // buildings sit on — matches the elevation grid's own extent (see terrainHeight.ts)
    const width = MAP_METERS_SIZE.widthMeters * TERRAIN_EXPANSION
    const depth = MAP_METERS_SIZE.heightMeters * TERRAIN_EXPANSION
    // segment counts are the grid's own resolution minus one -- must match exactly so each mesh
    // vertex lines up 1:1 with a terrainHeightmap.json entry (see terrainHeight.ts), letting the
    // sculpt tool write directly into the mesh's vertex grid with no resampling
    const pads = getBuildingPads(items)
    return displaceTerrain(
      new THREE.PlaneGeometry(
        width,
        depth,
        TERRAIN_GRID_COLS - 1,
        TERRAIN_GRID_ROWS - 1,
      ),
      pads,
    )
  }, [items])

  // sculpting bypasses the building-pad blend entirely -- you're editing the raw ground, and pads
  // reapply naturally once Save round-trips through a reload (see terrainHeight.ts)
  function paintAt(localX: number, localY: number) {
    applyBrush(
      workingHeights.current,
      localX,
      localY,
      brushRadius,
      brushStrength * sculptDirectionRef.current,
    )
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      position.setZ(i, workingHeights.current[i])
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }

  // event.point is real three.js world space; the geometry's own vertex buffer (and every
  // terrainHeight.ts helper) works in the mesh's plane-local space instead, which this rotation
  // maps to world as (x, height, -y) -- so the inverse is localX = worldX, localY = -worldZ
  function worldPointToLocal(point: THREE.Vector3) {
    return { localX: point.x, localY: -point.z }
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    if (!sculptable) return
    event.stopPropagation()
    ;(event.target as Element).setPointerCapture?.(event.pointerId)
    isSculptingRef.current = true
    sculptDirectionRef.current = event.shiftKey ? -1 : 1
    onSculptStart?.()
    const { localX, localY } = worldPointToLocal(event.point)
    paintAt(localX, localY)
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!sculptable || !isSculptingRef.current) return
    event.stopPropagation()
    const { localX, localY } = worldPointToLocal(event.point)
    paintAt(localX, localY)
  }

  function endSculpting(event: ThreeEvent<PointerEvent>) {
    if (!isSculptingRef.current) return
    isSculptingRef.current = false
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)
    onSculptEnd?.()
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endSculpting}
      onPointerLeave={endSculpting}
    >
      <meshStandardMaterial color="#9db97e" />
    </mesh>
  )
})
