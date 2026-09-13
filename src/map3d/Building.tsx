"use client"

import type { ThreeEvent } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"
import type { BuildingSpec } from "./buildingPlacement"
import { getTerrainHeightAt } from "./terrainHeight"

// parking lots and sports fields aren't buildings — they're ground, not a volume, so they still
// get a real traced footprint but stay flat rather than extruding into dark 8m monoliths. Height
// alone already encodes this (buildingPlacement.ts), so there's nothing tag-specific left here.
const HANDLE_RADIUS_METERS = 1.4
const HANDLE_HEIGHT_ABOVE_ROOF_METERS = 0.5

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

// a footprint point's [x, y] maps to local group space (x, ·, -y) -- see the extrude shape's
// rotation in the render below. The drag tool (Scene.tsx) needs the inverse to turn a ground
// raycast hit back into a footprint point.
function worldToFootprintPoint(
  spec: Pick<BuildingSpec, "x" | "z">,
  worldX: number,
  worldZ: number,
): [number, number] {
  return [worldX - spec.x, spec.z - worldZ]
}

export type BuildingEditor = {
  tool: "select" | "add" | "delete" | null
  selectedId: string | null
  // true only for the duration of an active vertex drag -- distinct from `tool`, since every
  // tool needs the building mesh clickable except during that one brief window
  draggingVertex: boolean
  onSelect: (id: string | null) => void
  onDelete: (spec: BuildingSpec) => void
  onVertexPointerDown: (
    spec: BuildingSpec,
    vertexIndex: number,
    isAltClick: boolean,
  ) => void
  onAddVertex: (
    spec: BuildingSpec,
    afterIndex: number,
    point: [number, number],
  ) => void
}

export function Building({
  spec,
  editor,
}: {
  spec: BuildingSpec
  editor?: BuildingEditor
}) {
  const groundY = getTerrainHeightAt(spec.x, spec.z)
  const geometry = useMemo(
    () => buildExtrudeGeometry(spec.footprint, spec.height),
    [spec.footprint, spec.height],
  )
  const selected = editor?.selectedId === spec.id

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (!editor || editor.tool === null) return
    event.stopPropagation()
    if (editor.tool === "delete") {
      editor.onDelete(spec)
      return
    }
    if (editor.tool === "select") editor.onSelect(selected ? null : spec.id)
  }

  return (
    <group position={[spec.x, groundY, spec.z]}>
      {/* the extruded shape's winding direction isn't guaranteed (footprints come from a
          traced convex hull), so double-sided avoids the top cap silently culling itself away */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={geometry}
        onClick={handleClick}
        // while dragging a footprint vertex, a building the drag ray happens to pass over would
        // otherwise steal the pointer-move event meant for the ground underneath it
        raycast={editor?.draggingVertex ? () => null : undefined}
      >
        <meshStandardMaterial color={spec.wallColor} side={THREE.DoubleSide} />
      </mesh>

      {selected && editor?.tool === "select" && (
        <EditHandles
          spec={spec}
          onVertexPointerDown={editor.onVertexPointerDown}
          onAddVertex={editor.onAddVertex}
        />
      )}
    </group>
  )
}

function EditHandles({
  spec,
  onVertexPointerDown,
  onAddVertex,
}: {
  spec: BuildingSpec
  onVertexPointerDown: BuildingEditor["onVertexPointerDown"]
  onAddVertex: BuildingEditor["onAddVertex"]
}) {
  const handleY = spec.height + HANDLE_HEIGHT_ABOVE_ROOF_METERS
  return (
    <>
      {spec.footprint.map((point, index) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: the index *is* the vertex's identity (its position in the polygon's point order), not an incidental list position
          key={index}
          position={[point[0], handleY, -point[1]]}
          onPointerDown={(event) => {
            event.stopPropagation()
            onVertexPointerDown(spec, index, event.altKey)
          }}
        >
          <sphereGeometry args={[HANDLE_RADIUS_METERS, 12, 12]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      ))}
      {spec.footprint.map((point, index) => {
        const next = spec.footprint[(index + 1) % spec.footprint.length]
        const midpoint: [number, number] = [
          (point[0] + next[0]) / 2,
          (point[1] + next[1]) / 2,
        ]
        return (
          <mesh
            // biome-ignore lint/suspicious/noArrayIndexKey: same fixed edge ordering as above
            key={index}
            position={[midpoint[0], handleY, -midpoint[1]]}
            onClick={(event) => {
              event.stopPropagation()
              onAddVertex(spec, index, midpoint)
            }}
          >
            <sphereGeometry args={[HANDLE_RADIUS_METERS * 0.6, 10, 10]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        )
      })}
    </>
  )
}

export { worldToFootprintPoint }
