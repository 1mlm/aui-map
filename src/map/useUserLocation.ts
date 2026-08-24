"use client"

import { useEffect, useState } from "react"
import { isWithinCampusBounds, latLongToPosition } from "./geo"

export type LocationStatus = "idle" | "requesting" | "granted" | "denied"

// once the browser's actually granted this before, it won't re-prompt anyway -- so a later visit
// can go straight to watching position instead of waiting for another tap
const LOCATION_GRANTED_STORAGE_KEY = "aui-map:location-granted"

function hasGrantedLocationBefore() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LOCATION_GRANTED_STORAGE_KEY) === "true"
}

// never fires the permission prompt on its own, on any device -- only an explicit tap
// (requestLocation) starts watching, unless this browser's granted it before, in which case
// there's nothing left to ask permission for, so this just goes ahead and shows where they are
export function useUserLocation() {
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  // true once a fix has landed outside the map's own bounds -- distinct from position being
  // null, which also just means "no fix yet"
  const [isOffCampus, setIsOffCampus] = useState(false)
  const [requested, setRequested] = useState(hasGrantedLocationBefore)

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
        localStorage.setItem(LOCATION_GRANTED_STORAGE_KEY, "true")
        const withinCampus = isWithinCampusBounds(
          coords.latitude,
          coords.longitude,
        )
        setIsOffCampus(!withinCampus)
        setPosition(
          withinCampus
            ? latLongToPosition(coords.latitude, coords.longitude)
            : null,
        )
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [requested])

  return {
    position,
    status,
    isOffCampus,
    requestLocation: () => setRequested(true),
  }
}
