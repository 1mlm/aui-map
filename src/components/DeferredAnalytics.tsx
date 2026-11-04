"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false },
)
const SpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false },
)

// measuring visitors isn't worth delaying the map for: the scripts only start once the browser is
// idle after the first paint (or after 3s at the latest)
export function DeferredAnalytics() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const idle =
      window.requestIdleCallback ??
      ((callback: () => void) => setTimeout(callback, 1500))
    const handle = idle(() => setReady(true), { timeout: 3000 })
    return () => {
      if (window.cancelIdleCallback && typeof handle === "number")
        window.cancelIdleCallback(handle)
    }
  }, [])

  if (!ready) return null
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
