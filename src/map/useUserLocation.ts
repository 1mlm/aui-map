"use client"

import { useEffect, useState } from "react"
import { isWithinCampusBounds, latLongToPosition } from "./geo"

// fetches the browser's geolocation silently on mount — no button, no toast, no error UI. The
// browser handles the permission prompt on its own; if it's denied (or was denied before), this
// just quietly never gets a position
export function useUserLocation() {
  const [position, setPosition] = useState<[number, number] | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isWithinCampusBounds(coords.latitude, coords.longitude)) return
        setPosition(latLongToPosition(coords.latitude, coords.longitude))
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }, [])

  return { position }
}
