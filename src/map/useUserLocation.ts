"use client"

import { useEffect, useState } from "react"
import { isWithinCampusBounds, latLongToPosition } from "./geo"

export type LocationStatus = "idle" | "requesting" | "granted" | "denied"

// mirrors useAvailableSpace's own compact thresholds, but read synchronously at mount instead of
// through a ResizeObserver — whether to silently fire a permission prompt has to be right from
// the very first render, not "eventually correct once the observer catches up". This still runs
// during SSR (client components render server-side too), where there's no real viewport at all —
// defaulting to compact there is the conservative choice: it just means auto-start waits one
// extra render for the client to correct it, never the reverse (firing the prompt too early)
function isCompactViewport() {
  if (typeof window === "undefined") return true
  return window.innerWidth < 480 || window.innerHeight < 560
}

// on a roomy screen the permission prompt is a small, unintrusive browser popover, so this starts
// watching immediately, silently — no button, no toast, no error UI. On a narrow/mobile screen
// that same prompt is a full-width sheet that feels like a surprise on page load, so there it
// waits for requestLocation() to be called from an explicit tap instead
export function useUserLocation() {
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const [requested, setRequested] = useState(() => !isCompactViewport())

  useEffect(() => {
    if (!requested) return
    if (!navigator.geolocation) {
      setStatus("denied")
      return
    }
    setStatus("requesting")
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setStatus("granted")
        if (!isWithinCampusBounds(coords.latitude, coords.longitude)) return
        setPosition(latLongToPosition(coords.latitude, coords.longitude))
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [requested])

  return { position, status, requestLocation: () => setRequested(true) }
}
