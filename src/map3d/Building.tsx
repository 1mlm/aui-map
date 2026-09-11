"use client"

import { useMemo } from "react"
import * as THREE from "three"
import { tagPinFillColor } from "@/map/tagColor"
import type { MapItem } from "@/map/types"
import { getBuildingPlacement } from "./buildingPlacement"
import { oklchToHex } from "./oklchToHex"
import { getTerrainHeightAt } from "./terrainHeight"

// every building is the same height for now — real per-building height is future work (see the
// 3D map backlog entry), the footprint *shape* is the real thing this pass gets right
const UNIFORM_BUILDING_HEIGHT_METERS = 8

// parking lots and sports fields aren't buildings — they're ground, not a volume, so they still
// get a real traced footprint but stay flat rather than extruding into dark 8m monoliths
const GROUND_FEATURE_TAG_IDS = new Set(["parking", "sports"])
const GROUND_FEATURE_HEIGHT_METERS = 0.3

function buildExtrudeGeometry(footprint: [number, number][], height: number) {
  const shape = new THREE.Shape()
  shape.moveTo(footprint[0][0], footprint[0][1])
  for (const [x, z] of footprint.slice(1)) shape.lineTo(x, z)
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  })
}

export function Building({ item }: { item: MapItem }) {
  const { x, z, footprint } = getBuildingPlacement(item)
  const groundY = getTerrainHeightAt(x, z)
  // crayon-soft rather than the raw tag color (tagColor.ts) — full-saturation tailwind hues read
  // fine as tiny pins but look garish across a whole building; this is the same softened tone the
  // 2D pins already use, so buildings stay color-coded by tag without clashing with the campus's
  // actual warm, muted palette
  const wallColor = useMemo(
    () => oklchToHex(tagPinFillColor(item.tag.color)),
    [item.tag.color],
  )
  const height = GROUND_FEATURE_TAG_IDS.has(item.tag.id)
    ? GROUND_FEATURE_HEIGHT_METERS
    : UNIFORM_BUILDING_HEIGHT_METERS
  const geometry = useMemo(
    () => buildExtrudeGeometry(footprint, height),
    [footprint, height],
  )

  return (
    <group position={[x, groundY, z]}>
      {/* the extruded shape's winding direction isn't guaranteed (footprints come from a
          traced convex hull), so double-sided avoids the top cap silently culling itself away */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={geometry}>
        <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
