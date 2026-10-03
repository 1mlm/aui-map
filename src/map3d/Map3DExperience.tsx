"use client"

import { Canvas } from "@react-three/fiber"
import { useEffect, useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { MapBrand } from "@/map/MapBrand"
import type { MapItem } from "@/map/types"
import { cn } from "@/shadcn/utils"
import { worldToFootprintPoint } from "./Building"
import type { FootprintEntry } from "./buildingFootprints"
import footprintsJson from "./buildingFootprints.json"
import type { BuildingSpec } from "./buildingPlacement"
import {
  BUILDING_WALL_COLOR,
  DEFAULT_NEW_BUILDING_HEIGHT,
  pinToBuildingSpec,
} from "./buildingPlacement"
import {
  buildingSpecToExtraRecord,
  getExtraBuildingSpecs,
} from "./extraBuildings"
import { type BuildingTool, Scene } from "./Scene"
import { saveMap3dData } from "./saveMap3dData"

// a new building's footprint needs at least a triangle to mean anything
const MIN_DRAFT_POINTS = 3

// same shell chrome as the 2D map (src/map/MapExperience.tsx) — the border + corner squircle
// fusers are the one piece of desktop chrome this prototype explicitly keeps
export function Map3DExperience({ items }: { items: MapItem[] }) {
  const [buildingTool, setBuildingTool] = useState<BuildingTool>(null)
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  )
  const [draftPoints, setDraftPoints] = useState<{ x: number; z: number }[]>([])
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

  function handleToggleAddTool() {
    setDraftPoints([])
    setBuildingTool((current) => (current === "add" ? null : "add"))
  }

  // reads the current draft/selection through functional state updates rather than closing over
  // buildingTool/draftPoints/buildings directly, so this effect only needs the (primitive, stable)
  // buildingTool as a dependency instead of resubscribing a window listener on every keystroke
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (buildingTool === "add") {
          setDraftPoints([])
          setBuildingTool(null)
          return
        }
        setSelectedBuildingId(null)
        return
      }
      if (event.key === "Enter" && buildingTool === "add") {
        setDraftPoints((currentDraft) => {
          if (currentDraft.length < MIN_DRAFT_POINTS) return currentDraft
          const [anchor, ...rest] = currentDraft
          const footprint: [number, number][] = [
            [0, 0],
            ...rest.map((point): [number, number] =>
              worldToFootprintPoint(anchor, point.x, point.z),
            ),
          ]
          const id = `extra-${crypto.randomUUID()}`
          setBuildings((currentBuildings) => [
            ...currentBuildings,
            {
              id,
              source: "extra",
              x: anchor.x,
              z: anchor.z,
              footprint,
              height: DEFAULT_NEW_BUILDING_HEIGHT,
              wallColor: BUILDING_WALL_COLOR,
              hidden: false,
            },
          ])
          setHasUnsavedChanges(true)
          setSelectedBuildingId(id)
          setBuildingTool(null)
          return []
        })
        return
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        buildingTool !== "add"
      ) {
        setSelectedBuildingId((currentSelected) => {
          if (!currentSelected) return currentSelected
          setBuildings((currentBuildings) => {
            const spec = currentBuildings.find((b) => b.id === currentSelected)
            if (!spec) return currentBuildings
            if (spec.source === "pin") {
              touchedPinIdsRef.current.add(spec.id)
              return currentBuildings.map((b) =>
                b.id === spec.id ? { ...b, hidden: true } : b,
              )
            }
            return currentBuildings.filter((b) => b.id !== spec.id)
          })
          setHasUnsavedChanges(true)
          return null
        })
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [buildingTool])

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

  const editHint =
    buildingTool === "add"
      ? draftPoints.length < MIN_DRAFT_POINTS
        ? "Click the ground to place footprint points · Esc to cancel"
        : "Enter to confirm · click to add more points · Esc to cancel"
      : selectedBuildingId
        ? "Drag a point to move it · click a green dot to add one · right-click a point to remove it · Delete to remove the building · Esc to deselect"
        : null

  return (
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      <div className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl">
        <Canvas dpr={[1, 1.5]}>
          <Scene
            items={items}
            buildings={buildings}
            buildingTool={buildingTool}
            selectedBuildingId={selectedBuildingId}
            draftPoints={draftPoints}
            onSelectBuilding={setSelectedBuildingId}
            onMoveVertex={handleMoveVertex}
            onAddVertex={handleAddVertex}
            onRemoveVertex={handleRemoveVertex}
            onDraftPointClick={(x, z) =>
              setDraftPoints((current) => [...current, { x, z }])
            }
          />
        </Canvas>

        <MapBrand />

        {editHint && (
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-4 py-2 text-foreground/80 text-xs shadow-lg sm:top-3">
            {editHint}
          </div>
        )}

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
            icon={ICONS.add}
            label="Add Building"
            layout="inline"
            aria-label="Click points on the ground to draft a new building's footprint, Enter to confirm"
            className={cn(buildingTool === "add" && "bg-foreground/10")}
            onClick={handleToggleAddTool}
          />
        </SquircleFuserContainer>
      </div>
    </div>
  )
}
