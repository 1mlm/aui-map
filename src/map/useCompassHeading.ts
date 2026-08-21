"use client"

import { useEffect, useRef, useState } from "react"

export type CompassPermission =
  | "not-needed"
  | "idle"
  | "requesting"
  | "granted"
  | "denied"

type IOSDeviceOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission: () => Promise<"granted" | "denied">
}

// safari gates orientation behind a real tap; chrome/android hand it over with no prompt at all
function getIOSOrientationGate(): IOSDeviceOrientationEvent | null {
  if (typeof DeviceOrientationEvent === "undefined") return null
  const ctor =
    DeviceOrientationEvent as unknown as Partial<IOSDeviceOrientationEvent>
  return typeof ctor.requestPermission === "function"
    ? (ctor as IOSDeviceOrientationEvent)
    : null
}

// compass heading, clockwise from north — matches the map's north-up image 1:1, no rotation math
function eventToHeading(event: DeviceOrientationEvent): number | null {
  const webkitHeading = (
    event as DeviceOrientationEvent & { webkitCompassHeading?: number }
  ).webkitCompassHeading
  if (typeof webkitHeading === "number") return webkitHeading
  if (event.absolute && event.alpha !== null) return (360 - event.alpha) % 360
  return null
}

export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null)
  const [permission, setPermission] = useState<CompassPermission>(() =>
    getIOSOrientationGate() ? "idle" : "not-needed",
  )
  const listeningRef = useRef(false)

  useEffect(() => {
    if (permission !== "not-needed" && permission !== "granted") return
    if (listeningRef.current) return
    listeningRef.current = true

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const nextHeading = eventToHeading(event)
      if (nextHeading !== null) setHeading(nextHeading)
    }

    const eventName =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation"
    window.addEventListener(eventName, handleOrientation)
    return () => window.removeEventListener(eventName, handleOrientation)
  }, [permission])

  const requestPermission = async () => {
    const gate = getIOSOrientationGate()
    if (!gate) return
    setPermission("requesting")
    try {
      const result = await gate.requestPermission()
      setPermission(result === "granted" ? "granted" : "denied")
    } catch {
      setPermission("denied")
    }
  }

  return { heading, permission, requestPermission }
}
