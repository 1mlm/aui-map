"use client"

import { Canvas } from "@react-three/fiber"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { MapBrand } from "@/map/MapBrand"
import type { MapItem } from "@/map/types"
import { cn } from "@/shadcn/utils"
import { Scene } from "./Scene"

// same shell chrome as the 2D map (src/map/MapExperience.tsx) — the border + corner squircle
// fusers are the one piece of desktop chrome this prototype explicitly keeps
export function Map3DExperience({ items }: { items: MapItem[] }) {
  const [showReference, setShowReference] = useState(false)

  return (
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      <div className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl">
        <Canvas dpr={[1, 1.5]}>
          <Scene items={items} showReference={showReference} />
        </Canvas>

        <MapBrand />

        {/* a plain button, not a Link — the earlier back-to-2D-map link wrapped an <a> in a
            display:contents box, which left the browser's default link color/underline free to
            bleed through onto the icon+text with nothing overriding it */}
        <button
          type="button"
          className="contents"
          onClick={() => setShowReference((current) => !current)}
          aria-label="Toggle the flat map as a tracing reference"
        >
          <SquircleFuserContainer
            align="top-right"
            superClassName="pointer-events-auto absolute top-0 right-0"
            className={cn(
              "gap-1.5 py-2 transition-colors hover:bg-foreground/5 active:bg-foreground/10",
              showReference && "bg-foreground/10",
            )}
          >
            <Icon icon={ICONS.edit} className="size-4" />
            <span className="text-sm font-semibold">Edit</span>
          </SquircleFuserContainer>
        </button>
      </div>
    </div>
  )
}
