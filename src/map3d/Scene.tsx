"use client"

import { Line, OrbitControls, PerspectiveCamera } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import {
  type ComponentRef,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import * as THREE from "three"
import { latLongToPosition } from "@/map/geo"
import type { MapItem } from "@/map/types"
import { Building, worldToFootprintPoint } from "./Building"
import type { BuildingSpec } from "./buildingPlacement"
import { ReferenceOverlay } from "./ReferenceOverlay"
import { Terrain } from "./Terrain"
import { getTerrainHeightAt } from "./terrainHeight"
import { getWorldBounds, positionToWorldPoint } from "./worldSpace"

const SKY_COLOR = "#bcd6ec"

// how far past the outermost building's edge the camera frames, so the cluster isn't cropped
// right at the frame's edge
const FRAMING_PADDING_METERS = 60
// how quickly the orbit pivot glides to its new target (selecting/deselecting a building) --
// higher is snappier, this is tuned to feel like a soft follow rather than an instant jump
const ORBIT_TARGET_FOLLOW_SPEED = 4
const DRAFT_MARKER_RADIUS_METERS = 1
const DRAFT_MARKER_HEIGHT_METERS = 0.6

export type BuildingTool = "add" | null

// a fixed-ish overhead-angled camera (city-builder game framing) rather than free orbit — full
// orbit lets you flip upside down under the terrain, which reads as broken rather than 3D
export function Scene({
  items,
  buildings,
  buildingTool,
  selectedBuildingId,
  draftPoints,
  onSelectBuilding,
  onMoveVertex,
  onAddVertex,
  onRemoveVertex,
  onDraftPointClick,
}: {
  items: MapItem[]
  buildings: BuildingSpec[]
  buildingTool: BuildingTool
  selectedBuildingId: string | null
  draftPoints: { x: number; z: number }[]
  onSelectBuilding: (id: string | null) => void
  onMoveVertex: (
    buildingId: string,
    vertexIndex: number,
    point: [number, number],
  ) => void
  onAddVertex: (
    buildingId: string,
    afterIndex: number,
    point: [number, number],
  ) => void
  onRemoveVertex: (buildingId: string, vertexIndex: number) => void
  onDraftPointClick: (worldX: number, worldZ: number) => void
}) {
  // OrbitControls listens on the canvas directly, underneath react-three-fiber's own event
  // system -- a vertex drag's stopPropagation() doesn't reach it, so a real orbit-fights-drag bug
  // needs this explicit toggle instead
  const [orbitEnabled, setOrbitEnabled] = useState(true)
  const draggingVertexRef = useRef<{
    buildingId: string
    vertexIndex: number
  } | null>(null)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)

  useEffect(() => {
    function endDrag() {
      if (!draggingVertexRef.current) return
      draggingVertexRef.current = null
      setOrbitEnabled(true)
    }
    window.addEventListener("pointerup", endDrag)
    return () => window.removeEventListener("pointerup", endDrag)
  }, [])

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

  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  // orbiting around the whole-campus center makes editing any one building swing it wildly
  // across the screen the moment you rotate -- pivoting on the selected building instead means
  // your point of view actually follows what you're working on
  const orbitTarget = useMemo(() => {
    if (!selectedBuilding) return new THREE.Vector3(center.x, 0, center.z)
    const groundY = getTerrainHeightAt(selectedBuilding.x, selectedBuilding.z)
    return new THREE.Vector3(
      selectedBuilding.x,
      groundY + selectedBuilding.height / 2,
      selectedBuilding.z,
    )
  }, [selectedBuilding, center])

  useFrame((_state, delta) => {
    const controls = controlsRef.current
    if (!controls) return
    const followAlpha = 1 - Math.exp(-ORBIT_TARGET_FOLLOW_SPEED * delta)
    controls.target.lerp(orbitTarget, followAlpha)
    controls.update()
  })

  return (
    <>
      <color attach="background" args={[SKY_COLOR]} />
      <fog
        attach="fog"
        args={[SKY_COLOR, cameraDistance, cameraDistance * 4]}
      />
      {/* real building footprints (buildingFootprints.ts) face every which way, unlike the old
          uniform axis-aligned boxes — a single key light left plenty of walls dark near-black.
          Higher ambient + a soft fill light from the opposite side keeps every face readable */}
      <ambientLight intensity={0.85} />
      <directionalLight
        position={[
          center.x - cameraDistance * 0.5,
          cameraDistance * 0.5,
          center.z - cameraDistance * 0.3,
        ]}
        intensity={0.35}
      />
      <directionalLight
        position={[
          center.x + cameraDistance * 0.5,
          cameraDistance * 0.9,
          center.z + cameraDistance * 0.3,
        ]}
        intensity={1.1}
      />
      <Terrain
        buildings={buildings}
        onGroundClick={
          buildingTool === "add"
            ? (worldX, worldZ) => onDraftPointClick(worldX, worldZ)
            : selectedBuildingId
              ? () => onSelectBuilding(null)
              : undefined
        }
        onGroundPointerMove={(worldX, worldZ) => {
          const dragging = draggingVertexRef.current
          if (!dragging) return
          const spec = buildings.find((b) => b.id === dragging.buildingId)
          if (!spec) return
          onMoveVertex(
            spec.id,
            dragging.vertexIndex,
            worldToFootprintPoint(spec, worldX, worldZ),
          )
        }}
      />
      {buildings
        .filter((spec) => !spec.hidden)
        .map((spec) => (
          <Building
            key={spec.id}
            spec={spec}
            editor={{
              tool: buildingTool,
              selectedId: selectedBuildingId,
              draggingVertex: !orbitEnabled,
              onSelect: onSelectBuilding,
              onVertexPointerDown: (vertexSpec, vertexIndex) => {
                draggingVertexRef.current = {
                  buildingId: vertexSpec.id,
                  vertexIndex,
                }
                setOrbitEnabled(false)
              },
              onVertexRemove: (vertexSpec, vertexIndex) =>
                onRemoveVertex(vertexSpec.id, vertexIndex),
              onAddVertex: (vertexSpec, afterIndex, point) =>
                onAddVertex(vertexSpec.id, afterIndex, point),
            }}
          />
        ))}
      <DraftFootprint points={draftPoints} />
      <Suspense fallback={null}>
        <ReferenceOverlay />
      </Suspense>
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
        ref={controlsRef}
        enabled={orbitEnabled}
        minDistance={cameraDistance * 0.15}
        maxDistance={cameraDistance * 2.5}
        maxPolarAngle={Math.PI * 0.48}
        enableDamping
      />
    </>
  )
}

// live preview of a new building's footprint while it's being clicked out point by point --
// markers at each placed point plus the edges connecting them, so it reads as "here's the shape
// so far" rather than a scatter of unrelated dots
function DraftFootprint({ points }: { points: { x: number; z: number }[] }) {
  const linePoints = useMemo<[number, number, number][]>(
    () =>
      points.map(({ x, z }) => [
        x,
        getTerrainHeightAt(x, z) + DRAFT_MARKER_HEIGHT_METERS,
        z,
      ]),
    [points],
  )

  return (
    <>
      {points.map((point, index) => (
        <DraftMarker
          // biome-ignore lint/suspicious/noArrayIndexKey: points are appended in click order and never reordered, so index is a stable identity here
          key={index}
          x={point.x}
          z={point.z}
        />
      ))}
      {linePoints.length > 1 && (
        <Line points={linePoints} color="#22c55e" lineWidth={2} />
      )}
    </>
  )
}

function DraftMarker({ x, z }: { x: number; z: number }) {
  const y = getTerrainHeightAt(x, z) + DRAFT_MARKER_HEIGHT_METERS
  return (
    <mesh position={[x, y, z]} raycast={() => null}>
      <sphereGeometry args={[DRAFT_MARKER_RADIUS_METERS, 12, 12]} />
      <meshBasicMaterial color="#22c55e" />
    </mesh>
  )
}
