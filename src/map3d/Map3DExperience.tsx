"use client"

import { Canvas } from "@react-three/fiber"
import { useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { MapBrand } from "@/map/MapBrand"
import type { MapItem } from "@/map/types"
import { cn } from "@/shadcn/utils"
import type { FootprintEntry } from "./buildingFootprints"
import footprintsJson from "./buildingFootprints.json"
import type { BuildingSpec } from "./buildingPlacement"
import {
  DEFAULT_NEW_BUILDING_COLOR,
  DEFAULT_NEW_BUILDING_FOOTPRINT,
  DEFAULT_NEW_BUILDING_HEIGHT,
  pinToBuildingSpec,
} from "./buildingPlacement"
import {
  buildingSpecToExtraRecord,
  getExtraBuildingSpecs,
} from "./extraBuildings"
import { saveMap3dData } from "./saveMap3dData"
import { type BuildingTool, Scene } from "./Scene"

// same shell chrome as the 2D map (src/map/MapExperience.tsx) — the border + corner squircle
// fusers are the one piece of desktop chrome this prototype explicitly keeps
export function Map3DExperience({ items }: { items: MapItem[] }) {
  const [showReference, setShowReference] = useState(false)
  const [buildingTool, setBuildingTool] = useState<BuildingTool>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  )
  const [buildings, setBuildings] = useState<BuildingSpec[]>(() => [
    ...items.map(pinToBuildingSpec),
    ...getExtraBuildingSpecs(),
  ])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // which pin-linked buildings actually got edited this session -- Save only overwrites these
  // entries in buildingFootprints.json, so a pin that was never touched keeps whatever it already
  // had on disk (including "no entry at all", meaning it still uses the runtime fallback square)
  // instead of every untouched pin getting a fabricated "real" entry written for it
  const touchedPinIdsRef = useRef(new Set<string>())

  function updateBuilding(
    id: string,
    updater: (spec: BuildingSpec) => BuildingSpec,
  ) {
    setBuildings((current) =>
      current.map((spec) => (spec.id === id ? updater(spec) : spec)),
    )
    setHasUnsavedChanges(true)
  }

  function toggleBuildingTool(tool: Exclude<BuildingTool, null>) {
    setBuildingTool((current) => (current === tool ? null : tool))
  }

  function handleMoveVertex(
    buildingId: string,
    vertexIndex: number,
    point: [number, number],
  ) {
    if (buildings.find((spec) => spec.id === buildingId)?.source === "pin")
      touchedPinIdsRef.current.add(buildingId)
    updateBuilding(buildingId, (spec) => ({
      ...spec,
      footprint: spec.footprint.map((existing, index) =>
        index === vertexIndex ? point : existing,
      ),
    }))
  }

  function handleAddVertex(
    buildingId: string,
    afterIndex: number,
    point: [number, number],
  ) {
    if (buildings.find((spec) => spec.id === buildingId)?.source === "pin")
      touchedPinIdsRef.current.add(buildingId)
    updateBuilding(buildingId, (spec) => {
      const footprint = [...spec.footprint]
      footprint.splice(afterIndex + 1, 0, point)
      return { ...spec, footprint }
    })
  }

  function handleRemoveVertex(buildingId: string, vertexIndex: number) {
    if (buildings.find((spec) => spec.id === buildingId)?.source === "pin")
      touchedPinIdsRef.current.add(buildingId)
    updateBuilding(buildingId, (spec) =>
      // a polygon needs at least 3 points -- silently refuse rather than leave a degenerate shape
      spec.footprint.length <= 3
        ? spec
        : {
            ...spec,
            footprint: spec.footprint.filter(
              (_, index) => index !== vertexIndex,
            ),
          },
    )
  }

  function handleDeleteBuilding(spec: BuildingSpec) {
    setSelectedBuildingId((current) => (current === spec.id ? null : current))
    if (spec.source === "pin") {
      touchedPinIdsRef.current.add(spec.id)
      updateBuilding(spec.id, (current) => ({ ...current, hidden: true }))
      return
    }
    setBuildings((current) => current.filter((b) => b.id !== spec.id))
    setHasUnsavedChanges(true)
  }

  function handleAddBuilding(worldX: number, worldZ: number) {
    const id = `extra-${crypto.randomUUID()}`
    setBuildings((current) => [
      ...current,
      {
        id,
        source: "extra",
        x: worldX,
        z: worldZ,
        footprint: DEFAULT_NEW_BUILDING_FOOTPRINT,
        height: DEFAULT_NEW_BUILDING_HEIGHT,
        wallColor: DEFAULT_NEW_BUILDING_COLOR,
        hidden: false,
      },
    ])
    setHasUnsavedChanges(true)
    setSelectedBuildingId(id)
    // switch straight to Select so the new building's corners are immediately draggable into
    // place instead of leaving the user stuck in Add mode after placing it
    setBuildingTool("select")
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const originalFootprints = footprintsJson as unknown as Record<
        string,
        FootprintEntry
      >
      const mergedFootprints = { ...originalFootprints }
      for (const pinId of touchedPinIdsRef.current) {
        const spec = buildings.find((b) => b.id === pinId && b.source === "pin")
        if (!spec) continue
        mergedFootprints[pinId] = {
          points: spec.footprint,
          fallback: false,
          hidden: spec.hidden || undefined,
        }
      }
      const extraRecords = buildings
        .filter((spec) => spec.source === "extra")
        .map(buildingSpecToExtraRecord)

      await saveMap3dData("buildingFootprints", mergedFootprints)
      await saveMap3dData("extraBuildings", extraRecords)
      // both files are static imports -- a full reload is the simplest way to get every consumer
      // back in sync with what just got written to disk
      window.location.reload()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      <div className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl">
        <Canvas dpr={[1, 1.5]}>
          <Scene
            items={items}
            showReference={showReference}
            buildings={buildings}
            buildingTool={buildingTool}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={setSelectedBuildingId}
            onMoveVertex={handleMoveVertex}
            onAddVertex={handleAddVertex}
            onRemoveVertex={handleRemoveVertex}
            onDeleteBuilding={handleDeleteBuilding}
            onAddBuilding={handleAddBuilding}
          />
        </Canvas>

        <MapBrand />

        <SquircleFuserContainer
          align="top-right"
          superClassName="pointer-events-auto absolute top-0 right-0"
          className="gap-1"
        >
          {hasUnsavedChanges && (
            <IconButton
              icon={ICONS.save}
              label={isSaving ? "Saving…" : "Save"}
              layout="inline"
              tone="primary"
              disabled={isSaving}
              onClick={handleSave}
            />
          )}
          <IconButton
            icon={ICONS.edit}
            label="Map"
            layout="inline"
            aria-label="Show or hide the flat map as a tracing reference on the ground"
            className={cn(showReference && "bg-foreground/10")}
            onClick={() => setShowReference((current) => !current)}
          />
          <IconButton
            icon={ICONS.cursor}
            label="Select"
            layout="inline"
            aria-label="Select a building to drag its footprint points -- alt-click a point to remove it, click an edge's green dot to add one"
            className={cn(buildingTool === "select" && "bg-foreground/10")}
            onClick={() => toggleBuildingTool("select")}
          />
          <IconButton
            icon={ICONS.add}
            label="Add"
            layout="inline"
            aria-label="Click the ground to place a new building"
            className={cn(buildingTool === "add" && "bg-foreground/10")}
            onClick={() => toggleBuildingTool("add")}
          />
          <IconButton
            icon={ICONS.delete}
            label="Delete"
            layout="inline"
            aria-label="Click a building to remove it"
            className={cn(buildingTool === "delete" && "bg-foreground/10")}
            onClick={() => toggleBuildingTool("delete")}
          />
        </SquircleFuserContainer>
      </div>
    </div>
  )
}
