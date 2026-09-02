"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { metersToNormalizedRadius, positionToStyle } from "./geo"
import type { useUserLocation } from "./useUserLocation"

export type UserLocation = ReturnType<typeof useUserLocation>

const DOT_POSITION_CLASS =
  "absolute z-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-2 ring-white shadow-[0_1px_6px_rgba(0,0,0,0.5)]"

// the blue dot, drawn inside the map's coordinate space rather than over the viewport. Purely
// visual -- granting compass orientation is the locate button's job (MapControls/
// LocateFloatingButton), not a tap hidden on this tiny dot
export function UserLocationMarker({
  position,
  heading,
  accuracy,
}: {
  position: UserLocation["position"]
  heading: number | null
  accuracy: UserLocation["accuracy"]
}) {
  if (!position) return null

  // sized in the same "% of the map image" coordinate space the dot's own position uses, rather
  // than the dot's fixed rem size — that way the halo's real-world size (a rough WiFi/IP fix on
  // campus can easily be 50-150m off) stays proportionally honest at every zoom level instead of
  // implying more precision than the browser actually gave us
  const accuracyRadius =
    accuracy !== null ? metersToNormalizedRadius(Math.max(accuracy, 1)) : null

  const accuracyHalo = accuracyRadius && (
    <span
      aria-hidden
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/15 ring-1 ring-blue-400/30"
      style={{
        ...positionToStyle(position),
        width: `${accuracyRadius.rx * 200}%`,
        height: `${accuracyRadius.ry * 200}%`,
      }}
    />
  )

  const dotChildren = (
    <>
      <span className="absolute inset-0 rounded-full bg-blue-500 opacity-75 motion-safe:animate-ping" />
      {heading !== null && (
        // inset-0 matches the dot's own box exactly, so the default center transform-origin is
        // the dot's real center — rotating this wrapper sweeps the tip around that point at a
        // fixed short reach instead of swinging out from some offset pivot
        <span
          className="absolute inset-0"
          style={{ transform: `rotate(${heading}deg)` }}
        >
          <Icon
            icon={ICONS.heading}
            strokeWidth={5}
            // top-0 left-1/2 + -translate-x/y-1/2 pins the icon's own center exactly on the
            // wrapper's top-center point (a flex items-start + negative-margin combo did this
            // before, but that's one line-height/baseline quirk away from drifting a few px off,
            // which is exactly what was showing up as "offset from center" once zoomed in).
            // the icon points down by default — rotate-180 is a fixed correction so it points
            // outward (up) at heading 0, independent of the heading rotation on the wrapper above
            className="-translate-x-1/2 -translate-y-1/2 absolute top-0 left-1/2 size-2.5 rotate-180 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          />
        </span>
      )}
    </>
  )

  return (
    <>
      {accuracyHalo}
      <span className={DOT_POSITION_CLASS} style={positionToStyle(position)}>
        {dotChildren}
      </span>
    </>
  )
}
