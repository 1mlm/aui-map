"use client"

import { useRef, useState } from "react"
import { isWithinCampusBounds, latLongToPosition } from "./geo"

type LocationStatus = "idle" | "loading" | "success" | "error"

const TOAST_DURATION_MS = 4000

function geolocationErrorToMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return "Location permission denied"
  if (error.code === error.TIMEOUT) return "Location request timed out"
  return "Location unavailable"
}

// asks for the browser's geolocation only on explicit user action (locate()), never on mount
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle")
  const [position, setPosition] = useState<[number, number] | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function fail(message: string) {
    setStatus("error")
    setErrorMessage(message)
    setPosition(null)
    setToastVisible(true)
    clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS)
  }

  function locate() {
    if (!navigator.geolocation) {
      fail("Geolocation is not supported on this device")
      return
    }

    setStatus("loading")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isWithinCampusBounds(coords.latitude, coords.longitude)) {
          fail("You're off campus")
          return
        }
        setPosition(latLongToPosition(coords.latitude, coords.longitude))
        setStatus("success")
      },
      (error) => fail(geolocationErrorToMessage(error)),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return { status, position, errorMessage, toastVisible, locate }
}
