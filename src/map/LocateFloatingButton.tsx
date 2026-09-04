"use client"

import { motion } from "motion/react"
import { IconButton } from "@/components/IconButton"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import type { CompassPermission } from "./useCompassHeading"
import type { LocationStatus } from "./useUserLocation"

// mobile-only. On the roomy desktop bar, locating and (if iOS asks) enabling the compass are just
// two states of the same top-right icon -- but that's easy to miss buried among four other small
// icons on a phone, and the old fix (a tooltip glued to the map's own blue dot) wasn't any more
// discoverable. This is its own floating button instead, front and center, that walks through
// both steps and then gets out of the way -- shake-to-recenter (useShakeGesture) covers "where am
// I again" from here on
export function LocateFloatingButton({
  locationStatus,
  compassPermission,
  onLocate,
  onRequestCompass,
}: {
  locationStatus: LocationStatus
  compassPermission: CompassPermission
  onLocate: () => void
  onRequestCompass: () => void
}) {
  const needsCompassTap =
    locationStatus === "granted" && compassPermission === "idle"
  const isBusy =
    locationStatus === "requesting" || compassPermission === "requesting"

  const label = needsCompassTap ? "Get direction" : "Find Me"
  // same "come tap me" cue as the Contribute button's first-ever-seen pulse, but not a one-time
  // thing here -- location not being on yet is itself the condition, every time, until it is
  const wantsAttention = !isBusy && locationStatus !== "granted"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="map-locate-floating pointer-events-auto absolute right-4 bottom-20"
    >
      <IconButton
        icon={
          isBusy
            ? ICONS.loading
            : needsCompassTap
              ? ICONS.direction
              : ICONS.locate
        }
        label={label}
        tone="floating"
        shape="corner-superellipse/1.2"
        iconClassName={cn("text-[1.75rem]", isBusy && "animate-spin")}
        labelClassName="text-[0.7rem] text-white/85"
        disabled={isBusy}
        className={cn(
          "size-20 gap-1 drop-shadow-lg drop-shadow-black/40",
          (wantsAttention || needsCompassTap) && "animate-pulse-attention",
        )}
        onClick={needsCompassTap ? onRequestCompass : onLocate}
      />
    </motion.div>
  )
}
