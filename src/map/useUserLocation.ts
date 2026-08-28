"use client"

import { useEffect, useState } from "react"
import {
  isWithinCampusBounds,
  latLongToPosition,
  type NormalizedPosition,
} from "./geo"
import {
  type LatLong,
  watchPositionAcrossTabs,
} from "./watchPositionAcrossTabs"

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
  const [position, setPosition] = useState<NormalizedPosition | null>(null)
  // the same fix, but never nulled out for being off-campus -- lets the off-campus edge
  // indicator point somewhere real instead of just knowing a boolean
  const [rawPosition, setRawPosition] = useState<NormalizedPosition | null>(
    null,
  )
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

    function handlePosition({ latitude, longitude }: LatLong) {
      setStatus("granted")
      localStorage.setItem(LOCATION_GRANTED_STORAGE_KEY, "true")
      const withinCampus = isWithinCampusBounds(latitude, longitude)
      const nextPosition = latLongToPosition(latitude, longitude)
      setIsOffCampus(!withinCampus)
      setRawPosition(nextPosition)
      setPosition(withinCampus ? nextPosition : null)
    }

    return watchPositionAcrossTabs(handlePosition, () => setStatus("denied"))
  }, [requested])

  return {
    position,
    rawPosition,
    status,
    isOffCampus,
    requestLocation: () => setRequested(true),
  }
}
