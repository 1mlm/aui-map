"use client"

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
  // nothing left to grant -- gone for good until the next full page load
  const isDone = locationStatus === "granted" && compassPermission !== "idle"

  if (isDone) return null

  return (
    <div className="map-locate-floating pointer-events-auto absolute right-4 bottom-20">
      <IconButton
        icon={
          isBusy
            ? ICONS.loading
            : needsCompassTap
              ? ICONS.heading
              : ICONS.locate
        }
        tone="floating"
        size="lg"
        aria-label={
          needsCompassTap ? "Enable compass orientation" : "Find my location"
        }
        iconClassName={isBusy ? "animate-spin" : undefined}
        disabled={isBusy}
        className={cn(
          "drop-shadow-lg drop-shadow-black/40",
          needsCompassTap && "animate-pulse-violet",
        )}
        onClick={needsCompassTap ? onRequestCompass : onLocate}
      />
    </div>
  )
}
