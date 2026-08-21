"use client"

import { positionToStyle } from "./geo"
import type { useUserLocation } from "./useUserLocation"

export type UserLocation = ReturnType<typeof useUserLocation>

// the blue dot, drawn inside the map's coordinate space rather than over the viewport
export function UserLocationMarker({
  position,
}: {
  position: UserLocation["position"]
}) {
  if (!position) return null

  return (
    <span
      className="absolute z-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-4 ring-blue-500/30"
      style={positionToStyle(position)}
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-75" />
    </span>
  )
}
