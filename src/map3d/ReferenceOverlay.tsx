"use client"

import { useTexture } from "@react-three/drei"
import { MAP_METERS_SIZE } from "@/map/geo"

// hovers a translucent copy of the flat 2D map above the scene as a tracing reference for
// whoever's placing/editing things — floating clear of the terrain rather than draped onto it,
// so it never fights the real geometry for z-order
const REFERENCE_HEIGHT_METERS = 90

export function ReferenceOverlay() {
  const texture = useTexture("/auimap-1312.webp")
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, REFERENCE_HEIGHT_METERS, 0]}
    >
      <planeGeometry
        args={[MAP_METERS_SIZE.widthMeters, MAP_METERS_SIZE.heightMeters]}
      />
      <meshBasicMaterial map={texture} transparent opacity={0.2} />
    </mesh>
  )
}
