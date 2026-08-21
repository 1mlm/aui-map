"use client"

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
  "absolute z-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-4 ring-blue-500/30"

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
            transform: `rotate(${heading}deg)`,
            transformOrigin: "50% 100%",
          }}
        >
          <span className="mb-1 size-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-blue-500" />
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
