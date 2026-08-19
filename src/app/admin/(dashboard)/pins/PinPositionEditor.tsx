"use client"

import { motion, useTransform } from "motion/react"
import Image from "next/image"
import { useRef } from "react"
import type React from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { latLongToPosition, positionToLatLong, positionToStyle, screenPointToPosition } from "@/map/geo"
import { PIN_TIP_FRACTION } from "@/map/MapPin"
import { pinCounterScale, useMapPanZoom } from "@/map/useMapPanZoom"

// mirrors the public map's own ctrl/cmd+click-to-survey-a-coordinate convention, so the same
// gesture that copies a coordinate elsewhere in the app moves a pin here — one gesture, one meaning
export function PinPositionEditor({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number
  longitude: number
  onChange: (position: { latitude: number; longitude: number }) => void
}) {
  const panZoom = useMapPanZoom()
  const imageBoxRef = useRef<HTMLDivElement>(null)
  const counterScale = useTransform(panZoom.scale, pinCounterScale)

  function handleClick(event: React.MouseEvent) {
    if (!event.ctrlKey && !event.metaKey) return
    const imageBox = imageBoxRef.current?.getBoundingClientRect()
    if (!imageBox) return
    const position = screenPointToPosition({ x: event.clientX, y: event.clientY }, imageBox)
    onChange(positionToLatLong(position))
  }

  const pinPosition = latLongToPosition(latitude, longitude)

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={panZoom.containerRef}
        {...panZoom.gestureHandlers}
        onClick={handleClick}
        style={{ touchAction: "none" }}
        className="relative aspect-square w-full max-w-52 shrink-0 overflow-hidden rounded-2xl corner-squircle bg-muted shadow-inner select-none"
      >
        <motion.div
          className="absolute inset-0 flex items-center justify-center [container-type:size]"
          style={{ scale: panZoom.scale, x: panZoom.x, y: panZoom.y }}
        >
          <div ref={imageBoxRef} className="relative size-[100cqmax] shrink-0">
            <Image
              src="/auimap.webp"
              alt="Campus map"
              fill
              unoptimized
              draggable={false}
              className="pointer-events-none"
            />
            <motion.div
              className="absolute"
              style={{
                ...positionToStyle(pinPosition),
                x: "-50%",
                y: `${-PIN_TIP_FRACTION * 100}%`,
                scale: counterScale,
                originX: 0.5,
                originY: PIN_TIP_FRACTION,
              }}
            >
              <Icon
                icon={ICONS.pin}
                fill="currentColor"
                className="size-6 text-red-500 drop-shadow-md drop-shadow-black/60"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
      <p className="flex items-center gap-1 text-center text-muted-foreground text-xs">
        <Icon icon={ICONS.cursor} className="size-3.5" />
        Ctrl+click (or ⌘+click) to move this pin
      </p>
    </div>
  )
}
