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

export type LocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "unavailable"

// once the browser's actually granted this before, it won't re-prompt anyway -- so a later visit
// can go straight to watching position instead of waiting for another tap
const LOCATION_GRANTED_STORAGE_KEY = "aui-map:location-granted"

function hasGrantedLocationBefore() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LOCATION_GRANTED_STORAGE_KEY) === "true"
}

// neither the browser's own `timeout` option nor its error callback are reliable everywhere --
// some browsers/in-app webviews just never call back at all (no fix, no error) when geolocation
// is blocked at the OS level or by a privacy setting. Without an app-level backstop, `status`
// gets stuck on "requesting" forever with no way out
const WATCHDOG_MS = 15_000

// never fires the permission prompt on its own, on any device -- only an explicit tap
// (requestLocation) starts watching, unless this browser's granted it before, in which case
// there's nothing left to ask permission for, so this just goes ahead and shows where they are.
// `attempt` (not a boolean) so a retry tap after a failure always re-runs the effect below, even
// though it was already "requested" once
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
  // the browser's own 1-sigma accuracy radius in meters, straight from the last fix -- lets the
  // UI show an honest "somewhere in here" halo instead of a pinpoint dot when the fix is rough
  // (WiFi/IP-based indoors, no clean GPS lock, ...)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(() =>
    hasGrantedLocationBefore() ? 1 : 0,
  )

  useEffect(() => {
    if (attempt === 0) return
    if (!navigator.geolocation) {
      setStatus("unavailable")
      return
    }
    setStatus("requesting")

    const watchdog = setTimeout(() => setStatus("unavailable"), WATCHDOG_MS)

    function handlePosition({ latitude, longitude, accuracy }: LatLong) {
      clearTimeout(watchdog)
      setStatus("granted")
      localStorage.setItem(LOCATION_GRANTED_STORAGE_KEY, "true")
      const withinCampus = isWithinCampusBounds(latitude, longitude)
      const nextPosition = latLongToPosition(latitude, longitude)
      setIsOffCampus(!withinCampus)
      setRawPosition(nextPosition)
      setPosition(withinCampus ? nextPosition : null)
      setAccuracy(accuracy)
    }

    function handleError(reason: "denied" | "unavailable") {
      clearTimeout(watchdog)
      setStatus(reason)
    }

    const stopWatching = watchPositionAcrossTabs(handlePosition, handleError)
    return () => {
      clearTimeout(watchdog)
      stopWatching()
    }
  }, [attempt])

  return {
    position,
    rawPosition,
    status,
    isOffCampus,
    accuracy,
    requestLocation: () => setAttempt((n) => n + 1),
  }
}
