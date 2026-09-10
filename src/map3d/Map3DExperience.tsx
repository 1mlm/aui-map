"use client"

import { Canvas } from "@react-three/fiber"
import Link from "next/link"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { MapBrand } from "@/map/MapBrand"
import type { MapItem } from "@/map/types"
import { Scene } from "./Scene"

// same shell chrome as the 2D map (src/map/MapExperience.tsx) — the border + corner squircle
// fusers are the one piece of desktop chrome this prototype explicitly keeps
export function Map3DExperience({ items }: { items: MapItem[] }) {
  return (
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      <div className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl">
        <Canvas dpr={[1, 1.5]}>
          <Scene items={items} />
        </Canvas>

        <MapBrand />

        <Link href="/" className="contents">
          <SquircleFuserContainer
            align="top-right"
            superClassName="pointer-events-auto absolute top-0 right-0"
            className="gap-1.5 py-2 transition-colors hover:bg-foreground/5 active:bg-foreground/10"
          >
            <Icon icon={ICONS.back} className="size-4" />
            <span className="text-sm font-semibold">2D map</span>
          </SquircleFuserContainer>
        </Link>
      </div>
    </div>
  )
}
