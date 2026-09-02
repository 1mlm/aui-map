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
// set on every fix that lands past VAGUE_ACCURACY_METERS -- a device with no GPS falls back to
// wifi-triangulated location, coarse enough on a campus that auto-resuming it unprompted on every
// return visit does more harm than good. Persisted (not just an in-memory flag) so a desktop that
// got a bad fix once stays gated on later visits too, without needing to detect *why* the fix was
// bad -- it self-corrects the moment a real fix lands, same key, opposite value
const LOCATION_VAGUE_STORAGE_KEY = "aui-map:location-vague"
// a browser with no GPS falls back to looking up the wifi network's registered location, which on
// a campus resolves to whichever router's closest, not an actual position. Past this the fix is
// too coarse to mean anything at building scale
export const VAGUE_ACCURACY_METERS = 120

function hasGrantedLocationBefore() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LOCATION_GRANTED_STORAGE_KEY) === "true"
}

function wasLastFixVague() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(LOCATION_VAGUE_STORAGE_KEY) === "true"
}

// neither the browser's own `timeout` option nor its error callback are reliable everywhere --
// some browsers/in-app webviews just never call back at all (no fix, no error) when geolocation
// is blocked at the OS level or by a privacy setting. Without an app-level backstop, `status`
// gets stuck on "requesting" forever with no way out
const WATCHDOG_MS = 15_000

// never fires the permission prompt on its own, on any device -- only an explicit tap
// (requestLocation) starts watching, unless this browser's granted it before and its last fix
// was a real one, in which case there's nothing left to ask permission for, so this just goes
// ahead and shows where they are. `attempt` (not a boolean) so a retry tap after a failure always
// re-runs the effect below, even though it was already "requested" once
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
    hasGrantedLocationBefore() && !wasLastFixVague() ? 1 : 0,
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
      localStorage.setItem(
        LOCATION_VAGUE_STORAGE_KEY,
        String(accuracy > VAGUE_ACCURACY_METERS),
      )
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
