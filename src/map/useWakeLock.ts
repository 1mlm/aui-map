"use client"

import { useEffect } from "react"

// keeps the screen from dimming/locking while the map is open — most useful outdoors, walking
// around campus glancing at the map, where the screen would otherwise sleep mid-navigation.
// the OS releases the lock whenever the tab goes into the background (spec behavior, not
// something this can prevent), so it has to be re-requested every time the tab comes back
export function useWakeLock() {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return

    let sentinel: WakeLockSentinel | null = null

    async function acquire() {
      try {
        sentinel = await navigator.wakeLock.request("screen")
      } catch {
        // denied, unsupported in this context (e.g. low battery), or the tab isn't visible —
        // the map still works fine without it, just no different from any other website
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") acquire()
    }

    acquire()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      sentinel?.release()
    }
  }, [])
}
