"use client"

import { Canvas } from "@react-three/fiber"
import { useRef, useState } from "react"
import { IconButton } from "@/components/IconButton"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { MapBrand } from "@/map/MapBrand"
import type { MapItem } from "@/map/types"
import { cn } from "@/shadcn/utils"
import { Scene } from "./Scene"
import { saveMap3dData } from "./saveMap3dData"
import type { TerrainHandle } from "./Terrain"

type EditTool = "reference" | "sculpt" | null

// same shell chrome as the 2D map (src/map/MapExperience.tsx) — the border + corner squircle
// fusers are the one piece of desktop chrome this prototype explicitly keeps
export function Map3DExperience({ items }: { items: MapItem[] }) {
  const [activeTool, setActiveTool] = useState<EditTool>(null)
  const [isSaving, setIsSaving] = useState(false)
  const terrainRef = useRef<TerrainHandle>(null)

  async function handleSaveTerrain() {
    if (!terrainRef.current) return
    setIsSaving(true)
    try {
      await saveMap3dData("terrainHeightmap", {
        rows: 161,
        cols: 161,
        heights: terrainRef.current.getHeights(),
      })
      // terrainHeightmap.json is a static import (terrainHeight.ts) -- a full reload is the
      // simplest way to get every consumer (the ground mesh, every building's groundY) back in
      // sync with what just got written to disk
      window.location.reload()
    } finally {
      setIsSaving(false)
    }
  }

  function toggleTool(tool: Exclude<EditTool, null>) {
    setActiveTool((current) => (current === tool ? null : tool))
  }

  return (
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      <div className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl">
        <Canvas dpr={[1, 1.5]}>
          <Scene
            items={items}
            showReference={activeTool === "reference"}
            sculptable={activeTool === "sculpt"}
            terrainRef={terrainRef}
          />
        </Canvas>

        <MapBrand />

        <SquircleFuserContainer
          align="top-right"
          superClassName="pointer-events-auto absolute top-0 right-0"
          className="gap-1"
        >
          {activeTool === "sculpt" && (
            <IconButton
              icon={ICONS.save}
              label={isSaving ? "Saving…" : "Save"}
              layout="inline"
              tone="primary"
              disabled={isSaving}
              onClick={handleSaveTerrain}
            />
          )}
          {/* a plain button, not a Link — the earlier back-to-2D-map link wrapped an <a> in a
              display:contents box, which left the browser's default link color/underline free to
              bleed through onto the icon+text with nothing overriding it */}
          <IconButton
            icon={ICONS.edit}
            label="Reference"
            layout="inline"
            aria-label="Toggle the flat map as a tracing reference"
            className={cn(activeTool === "reference" && "bg-foreground/10")}
            onClick={() => toggleTool("reference")}
          />
          <IconButton
            icon={ICONS.sculptTerrain}
            label="Sculpt"
            layout="inline"
            aria-label="Sculpt the terrain -- drag to raise, shift-drag to lower"
            className={cn(activeTool === "sculpt" && "bg-foreground/10")}
            onClick={() => toggleTool("sculpt")}
          />
        </SquircleFuserContainer>
      </div>
    </div>
  )
}
