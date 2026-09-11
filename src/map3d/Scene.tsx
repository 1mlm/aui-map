"use client"

import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useMemo } from "react"
import { latLongToPosition } from "@/map/geo"
import type { MapItem } from "@/map/types"
import { Building } from "./Building"
import { Terrain } from "./Terrain"
import { getWorldBounds, positionToWorldPoint } from "./worldSpace"

const SKY_COLOR = "#bcd6ec"

// how far past the outermost building's edge the camera frames, so the cluster isn't cropped
// right at the frame's edge
const FRAMING_PADDING_METERS = 60

// a fixed-ish overhead-angled camera (city-builder game framing) rather than free orbit — full
// orbit lets you flip upside down under the terrain, which reads as broken rather than 3D
export function Scene({ items }: { items: MapItem[] }) {
  const { center, cameraDistance } = useMemo(() => {
    const points = items.map((item) =>
      positionToWorldPoint(latLongToPosition(item.latitude, item.longitude)),
    )
    const bounds = getWorldBounds(points)
    return {
      center: bounds.center,
      cameraDistance: bounds.radius + FRAMING_PADDING_METERS,
    }
  }, [items])

  return (
    <>
      <color attach="background" args={[SKY_COLOR]} />
      <fog
        attach="fog"
        args={[SKY_COLOR, cameraDistance, cameraDistance * 4]}
      />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[
          center.x + cameraDistance * 0.5,
          cameraDistance * 0.9,
          center.z + cameraDistance * 0.3,
        ]}
        intensity={1.1}
      />
      <Terrain items={items} />
      {items.map((item) => (
        <Building key={item.id} item={item} />
      ))}
      <PerspectiveCamera
        makeDefault
        fov={42}
        position={[
          center.x + cameraDistance * 0.85,
          cameraDistance * 0.75,
          center.z + cameraDistance * 0.85,
        ]}
      />
      <OrbitControls
        target={[center.x, 0, center.z]}
        minDistance={cameraDistance * 0.15}
        maxDistance={cameraDistance * 2.5}
        maxPolarAngle={Math.PI * 0.48}
        enableDamping
      />
    </>
  )
}
