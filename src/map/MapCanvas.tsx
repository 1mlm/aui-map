"use client"

import { motion, useMotionValueEvent } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { formatCoordinates, positionToLatLong, screenPointToPosition } from "./geo"
import { MapPin, PinInnerShadowFilter } from "./MapPin"
import type { MapItem } from "./types"
import { useMapPanZoom } from "./useMapPanZoom"
import { UserLocationMarker, type UserLocation } from "./UserLocationMarker"

const SURVEYED_COORD_TOAST_MS = 3000

export function MapCanvas({
  items,
  selectedId,
  onSelect,
  userPosition,
  hoveredTagId,
}: {
  items: MapItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  userPosition: UserLocation["position"]
  hoveredTagId: string | null
}) {
  const panZoom = useMapPanZoom()
  const imageBoxRef = useRef<HTMLDivElement>(null)
  const [surveyedCoord, setSurveyedCoord] = useState<string | null>(null)
  const surveyedCoordTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(surveyedCoordTimer.current), [])

  // toggled imperatively instead of through React state, so 69 pins dropping their shadow
  // filters mid-gesture doesn't itself cost a render — see useMapPanZoom's isMoving for why
  useMotionValueEvent(panZoom.isMoving, "change", (value) => {
    imageBoxRef.current?.toggleAttribute("data-moving", value === 1)
  })

  // ctrl/cmd + click reads the coordinate under the cursor and copies it in data.ts's format, so
  // new map items can be surveyed straight off the satellite image
  function copyCoordinateUnderCursor(event: React.MouseEvent) {
    const imageBox = imageBoxRef.current?.getBoundingClientRect()
    if (!event.ctrlKey && !event.metaKey) return
    if (!imageBox) return

    const clicked = screenPointToPosition({ x: event.clientX, y: event.clientY }, imageBox)
    const coord = formatCoordinates(positionToLatLong(clicked))

    navigator.clipboard.writeText(coord)
    triggerHaptic("success")
    setSurveyedCoord(coord)

    // restarts on every survey, so copying twice in a row doesn't inherit the first countdown
    clearTimeout(surveyedCoordTimer.current)
    surveyedCoordTimer.current = setTimeout(() => setSurveyedCoord(null), SURVEYED_COORD_TOAST_MS)
  }

  return (
    <div
      ref={panZoom.containerRef}
      {...panZoom.gestureHandlers}
      onClick={copyCoordinateUnderCursor}
      style={{ touchAction: "none" }}
      className={cn(
        "absolute inset-0 select-none overflow-hidden bg-background transition-[box-shadow]",
        panZoom.hitLimit && "shadow-[inset_0_0_0_4px_rgba(220,38,38,0.45)]",
      )}
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-center [container-type:size]"
        style={{ scale: panZoom.scale, x: panZoom.x, y: panZoom.y }}
      >
        {/* the image is square while the viewport isn't, so anything placed against the viewport
            box would drift as the image gets cropped to cover it. This square box covers the
            viewport and becomes the one coordinate space the image and every marker agree on.
            Its side is the viewport's longer edge — asking for a square via min-width AND
            min-height instead lets a portrait phone win both, which stretches the image */}
        <div ref={imageBoxRef} className="relative size-[100cqmax] shrink-0">
          {/* unoptimized on purpose: the optimizer would hand back a copy sized to the viewport,
              which is exactly the detail zooming needs. This file is already a tuned webp */}
          <Image
            src="/auimap.webp"
            alt="Campus map"
            fill
            priority
            unoptimized
            draggable={false}
            className="pointer-events-none"
          />
          <UserLocationMarker position={userPosition} />
          {items.map((item) => (
            <MapPin
              key={item.id}
              selected={item.id === selectedId}
              viewportScale={panZoom.scale}
              onSelect={() => onSelect(item.id === selectedId ? null : item.id)}
              previewing={hoveredTagId !== null}
              matchesPreview={item.tag.id === hoveredTagId}
              {...{ item }}
            />
          ))}
        </div>
      </motion.div>

      {/* recesses the map behind the border and the squircle containers floating above it */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 shadow-[inset_0_0_32px_8px_rgba(0,0,0,0.55)]"
      />

      {surveyedCoord && (
        <SquircleFuserContainer
          align="bottom-center"
          superClassName="absolute bottom-0 left-1/2 -translate-x-1/2"
          className="gap-2 text-sm"
        >
          <Icon icon={ICONS.copy} className="text-muted-foreground" />
          <span className="font-mono">{surveyedCoord}</span>
        </SquircleFuserContainer>
      )}

      <PinInnerShadowFilter />
    </div>
  )
}
