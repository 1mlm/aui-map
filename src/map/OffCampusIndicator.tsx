"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { clampToMapEdge, type NormalizedPosition, positionToStyle } from "./geo"

// GTA5's own "objective marker" treatment for a point off the visible map: pinned to the edge,
// arrow rotated to keep pointing the real direction. Drawn in the same coordinate space as every
// pin (see MapCanvas), so it rides the map's own pan/zoom rather than the viewport. Purely
// decorative — MapControls' locate button already carries the "you're not on campus" text, this
// is just the visual of which way that actually is
export function OffCampusIndicator({
  position,
}: {
  position: NormalizedPosition
}) {
  const { edgePosition, bearingDeg } = clampToMapEdge(position)

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-10 flex size-8 -translate-1/2 items-center justify-center rounded-full bg-primary shadow-[0_1px_6px_rgba(0,0,0,0.5)] ring-2 ring-white motion-safe:animate-pulse"
      style={positionToStyle(edgePosition)}
    >
      <Icon
        icon={ICONS.heading}
        strokeWidth={3}
        className="size-4 text-primary-foreground"
        style={{ transform: `rotate(${bearingDeg}deg)` }}
      />
    </span>
  )
}
