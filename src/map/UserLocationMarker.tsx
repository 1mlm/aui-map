"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import { triggerHaptic } from "@/utils/haptics"
import { positionToStyle } from "./geo"
import type { CompassPermission } from "./useCompassHeading"
import type { useUserLocation } from "./useUserLocation"

export type UserLocation = ReturnType<typeof useUserLocation>

const COMPASS_PROMPT_TEXT: Record<
  Exclude<CompassPermission, "not-needed" | "granted">,
  string
> = {
  idle: "Tap for compass heading",
  requesting: "Enabling compass…",
  denied: "Compass permission denied",
}

const DOT_POSITION_CLASS =
  "absolute z-0 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-2 ring-white shadow-[0_1px_6px_rgba(0,0,0,0.5)]"

// the blue dot, drawn inside the map's coordinate space rather than over the viewport. On iOS,
// compass heading needs a real tap to grant orientation permission, so the dot doubles as that
// tap target until it's granted (or denied)
export function UserLocationMarker({
  position,
  heading,
  compassPermission,
  onRequestCompass,
}: {
  position: UserLocation["position"]
  heading: number | null
  compassPermission: CompassPermission
  onRequestCompass: () => void
}) {
  if (!position) return null

  const dotChildren = (
    <>
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-75" />
      {heading !== null && (
        <span
          className="absolute inset-x-0 bottom-1/2 flex justify-center"
          style={{
            // the icon points down by default, so a flat rotate(heading) would have it facing the
            // wrong way at heading 0 (north/up) — the extra 180 flips its rest pose to point up
            transform: `rotate(${heading + 180}deg)`,
            transformOrigin: "50% 100%",
          }}
        >
          <Icon
            icon={ICONS.heading}
            strokeWidth={2.5}
            className="mb-0.5 size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          />
        </span>
      )}
    </>
  )

  if (compassPermission === "not-needed" || compassPermission === "granted")
    return (
      <span className={DOT_POSITION_CLASS} style={positionToStyle(position)}>
        {dotChildren}
      </span>
    )

  return (
    <Tooltip open>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={compassPermission !== "idle"}
          onClick={() => {
            triggerHaptic()
            onRequestCompass()
          }}
          className={DOT_POSITION_CLASS}
          style={positionToStyle(position)}
        >
          {dotChildren}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {COMPASS_PROMPT_TEXT[compassPermission]}
      </TooltipContent>
    </Tooltip>
  )
}
