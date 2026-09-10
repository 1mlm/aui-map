"use client"

import { useMemo } from "react"
import * as THREE from "three"
import { latLongToPosition } from "@/map/geo"
import { tagPinFillColor } from "@/map/tagColor"
import type { MapItem } from "@/map/types"
import { getBuildingOverride } from "./buildingOverrides"
import { getBuildingTemplate } from "./buildingTemplates"
import { getTerrainHeightAt } from "./terrainHeight"
import { oklchToHex } from "./oklchToHex"
import { positionToWorldPoint } from "./worldSpace"

// how much of a gable/domed building's total height is walls vs the roof/dome sitting on top
const ROOF_HEIGHT_SHARE = 0.35

// a gable roof's triangular cross-section, extruded along the building's depth
function buildGableRoofGeometry(
  width: number,
  depth: number,
  roofHeight: number,
) {
  const profile = new THREE.Shape()
  profile.moveTo(-width / 2, 0)
  profile.lineTo(width / 2, 0)
  profile.lineTo(0, roofHeight)
  profile.closePath()
  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth,
    bevelEnabled: false,
  })
  // ExtrudeGeometry extrudes the profile from z=0 to z=depth rather than centering it, so the
  // roof mesh has to be nudged back by half its own depth to sit centered like the box under it
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

export function Building({ item }: { item: MapItem }) {
  const template = {
    ...getBuildingTemplate(item.tag.id),
    ...getBuildingOverride(item.id),
  }
  const { x, z } = positionToWorldPoint(
    latLongToPosition(item.latitude, item.longitude),
  )
  const groundY = getTerrainHeightAt(x, z)
  // crayon-soft rather than the raw tag color (tagColor.ts) — full-saturation tailwind hues read
  // fine as tiny pins but look garish across a whole building; this is the same softened tone the
  // 2D pins already use, so buildings stay color-coded by tag without clashing with the campus's
  // actual warm, muted palette
  const wallColor = useMemo(
    () => oklchToHex(tagPinFillColor(item.tag.color)),
    [item.tag.color],
  )

  const hasCapRoof = template.shape === "gable" || template.shape === "domed"
  const wallHeight = hasCapRoof
    ? template.heightMeters * (1 - ROOF_HEIGHT_SHARE)
    : template.heightMeters
  const capHeight = template.heightMeters * ROOF_HEIGHT_SHARE
  const radius =
    (template.footprintWidthMeters + template.footprintDepthMeters) / 4

  const gableRoofGeometry = useMemo(
    () =>
      template.shape === "gable"
        ? buildGableRoofGeometry(
            template.footprintWidthMeters,
            template.footprintDepthMeters,
            capHeight,
          )
        : null,
    [
      template.shape,
      template.footprintWidthMeters,
      template.footprintDepthMeters,
      capHeight,
    ],
  )

  return (
    <group position={[x, groundY, z]}>
      {template.shape === "domed" ? (
        <mesh position={[0, wallHeight / 2, 0]}>
          <cylinderGeometry args={[radius, radius, wallHeight, 8]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ) : (
        <mesh position={[0, wallHeight / 2, 0]}>
          <boxGeometry
            args={[
              template.footprintWidthMeters,
              wallHeight,
              template.footprintDepthMeters,
            ]}
          />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {template.shape === "domed" && (
        <mesh position={[0, wallHeight + capHeight / 2, 0]}>
          <coneGeometry args={[radius, capHeight, 8]} />
          <meshStandardMaterial color={template.roofColor} />
        </mesh>
      )}
      {gableRoofGeometry && (
        <mesh position={[0, wallHeight, 0]} geometry={gableRoofGeometry}>
          <meshStandardMaterial color={template.roofColor} />
        </mesh>
      )}
    </group>
  )
}
