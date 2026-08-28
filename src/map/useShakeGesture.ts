"use client"

import { useEffect, useRef } from "react"

// tuned against a real phone shake, not a jostle in a pocket or a bumpy table — acceleration
// spikes hard on a shake (easily >25 m/s² including gravity), and a real shake reverses direction
// repeatedly within a couple hundred ms
const SHAKE_ACCELERATION_THRESHOLD = 25
const SHAKE_COOLDOWN_MS = 1500

// devicemotion, not deviceorientation — this wants acceleration spikes, not compass heading, so
// it's a separate listener from useCompassHeading rather than sharing one
export function useShakeGesture(onShake: () => void) {
  const lastShakeAtRef = useRef(0)
  const onShakeRef = useRef(onShake)
  onShakeRef.current = onShake

  useEffect(() => {
    if (typeof DeviceMotionEvent === "undefined") return

    function handleMotion(event: DeviceMotionEvent) {
      const acceleration = event.accelerationIncludingGravity
      if (!acceleration) return
      const magnitude = Math.sqrt(
        (acceleration.x ?? 0) ** 2 +
          (acceleration.y ?? 0) ** 2 +
          (acceleration.z ?? 0) ** 2,
      )
      if (magnitude < SHAKE_ACCELERATION_THRESHOLD) return

      const now = Date.now()
      if (now - lastShakeAtRef.current < SHAKE_COOLDOWN_MS) return
      lastShakeAtRef.current = now
      onShakeRef.current()
    }

    window.addEventListener("devicemotion", handleMotion)
    return () => window.removeEventListener("devicemotion", handleMotion)
  }, [])
}
