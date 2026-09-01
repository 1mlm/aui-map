"use client"

import Image from "next/image"
import { useRef } from "react"
import { cn } from "@/shadcn/utils"
import {
  latLongToPosition,
  positionToLatLong,
  positionToStyle,
  screenPointToPosition,
} from "./geo"

export type Placement = { latitude: number; longitude: number }
export type PickerMarker = Placement & { id: string; selected?: boolean }

// a still, unzoomable campus image you drop a point onto. Deliberately not the real MapCanvas:
// picking a spot wants one tap on a whole-campus view, and the pan/zoom rig would turn every
// attempted tap into a possible drag
export function MiniMapPicker({
  value,
  markers = [],
  onPick,
  onSelectMarker,
  className,
}: {
  value: Placement | null
  markers?: PickerMarker[]
  onPick: (placement: Placement) => void
  onSelectMarker?: (id: string) => void
  className?: string
}) {
  const imageRef = useRef<HTMLImageElement>(null)

  function handleClick(event: React.MouseEvent<HTMLElement>) {
    const box = imageRef.current?.getBoundingClientRect()
    if (!box) return
    onPick(
      positionToLatLong(
        screenPointToPosition({ x: event.clientX, y: event.clientY }, box),
      ),
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        // touch-manipulation drops the browser's default double-tap-to-zoom delay, which inside a
        // scrollable popover can otherwise eat the first tap as a pan gesture instead of a click
        "relative block w-full cursor-crosshair touch-manipulation overflow-hidden rounded-xl corner-squircle border border-border",
        className,
      )}
    >
      <Image
        ref={imageRef}
        src="/auimap-1312.webp"
        alt="Campus map"
        width={1312}
        height={1312}
        className="w-full"
      />
      {markers.map((marker) => (
        <span
          key={marker.id}
          onPointerDown={(event) => {
            event.stopPropagation()
            onSelectMarker?.(marker.id)
          }}
          style={positionToStyle(
            latLongToPosition(marker.latitude, marker.longitude),
          )}
          className={cn(
            "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
            marker.selected
              ? "border-primary bg-primary/60"
              : "border-white bg-black/60",
          )}
        />
      ))}
      {value && (
        <span
          style={positionToStyle(
            latLongToPosition(value.latitude, value.longitude),
          )}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-primary bg-primary"
        />
      )}
    </button>
  )
}
