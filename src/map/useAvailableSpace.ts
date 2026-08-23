"use client"

import { useLayoutEffect, useState } from "react"

// below this a 320px side panel stops being a panel and becomes most of the screen. The brand
// pill / controls / credit line used to live here too, each behind their own JS-measured
// threshold — moved to pure CSS container queries (globals.css's .map-shell rules) since that
// chrome is visible on first paint and a JS measurement can't land before that paint happens.
// MapDetailPanel only ever appears after a pin is selected, well after hydration, so there's no
// equivalent first-paint flash risk here and no reason to give up the real measurement for it
const MIN_WIDTH_FOR_SIDE_PANEL = 640

export function useAvailableSpace(ref: React.RefObject<HTMLElement | null>) {
  // starts at 0 on both server and client so the first client render matches the server's HTML
  // exactly — reading window.innerWidth here instead would get the layout right one render
  // sooner, but at the cost of a genuine hydration mismatch, since this value drives real DOM
  // output. The layout effect below corrects it before the browser ever paints a client-rendered
  // frame — MapDetailPanel itself only ever mounts well after that point anyway
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return { docksPanel: width < MIN_WIDTH_FOR_SIDE_PANEL }
}
