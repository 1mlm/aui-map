"use client"

import { useEffect, useState } from "react"

// Each rule owns the one piece of chrome it decides, measured against what actually stops fitting
// rather than device breakpoints — so a narrow window on a desktop behaves like a phone.
const MIN_WIDTH = {
  // the brand pill sitting beside the control cluster without the two meeting
  projectName: 620,
  // the full credit line rather than a lone source-code button
  fullCredit: 480,
  // below this a 320px side panel stops being a panel and becomes most of the screen
  sidePanel: 640,
}
const MIN_HEIGHT_FOR_FULL_CREDIT = 560

export function useAvailableSpace(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  // 0 only happens on the very first paint, before the observer has measured — assume roomy so
  // the full layout doesn't flash its collapsed form
  const width = size.width || Number.POSITIVE_INFINITY
  const height = size.height || Number.POSITIVE_INFINITY

  return {
    showsProjectName: width >= MIN_WIDTH.projectName,
    showsFullCredit: width >= MIN_WIDTH.fullCredit && height >= MIN_HEIGHT_FOR_FULL_CREDIT,
    docksPanel: width < MIN_WIDTH.sidePanel,
  }
}
