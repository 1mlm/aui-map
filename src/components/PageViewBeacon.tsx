"use client"

import { useEffect } from "react"
import { getVisitor } from "@/utils/visitor"

// counts a page load in our own database (see PageView). Sent once the browser is idle so it can
// never compete with the map for the first paint, and with sendBeacon so it survives a page close
export function PageViewBeacon() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return

    const idle =
      window.requestIdleCallback ??
      ((callback: () => void) => setTimeout(callback, 1500))
    const handle = idle(
      () => {
        const { id, isNew } = getVisitor()
        let refHost = ""
        try {
          refHost = document.referrer ? new URL(document.referrer).hostname : ""
        } catch {}
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true
        navigator.sendBeacon(
          "/api/hit",
          new Blob(
            [
              JSON.stringify({
                path: location.pathname,
                s: new URLSearchParams(location.search).get("s"),
                ref: refHost,
                vid: id,
                isNew,
                standalone,
              }),
            ],
            { type: "application/json" },
          ),
        )
      },
      { timeout: 4000 },
    )
    return () => {
      if (window.cancelIdleCallback && typeof handle === "number")
        window.cancelIdleCallback(handle)
    }
  }, [])

  return null
}
