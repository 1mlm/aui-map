"use client"

import { useEffect, useState } from "react"
import { isWithinCampusBounds, latLongToPosition } from "./geo"

// watches the browser's geolocation silently from mount — no button, no toast, no error UI. The
// browser handles the permission prompt on its own; if it's denied (or was denied before), this
// just quietly never gets a position
export function useUserLocation() {
  const [position, setPosition] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (!isWithinCampusBounds(coords.latitude, coords.longitude)) return
        setPosition(latLongToPosition(coords.latitude, coords.longitude))
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { position }
}
