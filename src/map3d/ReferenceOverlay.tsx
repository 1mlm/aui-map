"use client"

import { useTexture } from "@react-three/drei"
import { useMemo } from "react"
import * as THREE from "three"
import { MAP_METERS_SIZE } from "@/map/geo"
import { getTerrainHeightAt } from "./terrainHeight"

// draped a hair above the actual terrain surface (not floating high above it like an earlier
// version did) so it stays registered with the buildings sitting on that same ground from every
// camera angle -- a floating plane drifts out of alignment with parallax the moment you orbit
const GROUND_CLEARANCE_METERS = 0.3
const OVERLAY_SEGMENTS = 40

function drapeOnTerrain(geometry: THREE.PlaneGeometry) {
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const z = position.getY(i) // still plane-local Y (becomes world Z after rotation)
    position.setZ(i, getTerrainHeightAt(x, z) + GROUND_CLEARANCE_METERS)
  }
  geometry.computeVertexNormals()
  return geometry
}

export function ReferenceOverlay() {
  const texture = useTexture("/auimap-1312.webp")
  const geometry = useMemo(
    () =>
      drapeOnTerrain(
        new THREE.PlaneGeometry(
          MAP_METERS_SIZE.widthMeters,
          MAP_METERS_SIZE.heightMeters,
          OVERLAY_SEGMENTS,
          OVERLAY_SEGMENTS,
        ),
      ),
    [],
  )
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      // purely a tracing aid -- it must never steal ground clicks meant for placing/dragging
      raycast={() => null}
    >
      <meshBasicMaterial map={texture} transparent opacity={0.1} />
    </mesh>
  )
}
