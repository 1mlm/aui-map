"use client"

import { useLayoutEffect, useState } from "react"

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
  // starts at 0 on both server and client so the first client render matches the server's HTML
  // exactly — reading window.innerWidth here instead would get the layout right one render
  // sooner, but at the cost of a genuine hydration mismatch, since this value drives real DOM
  // output. The layout effect below corrects it before the browser ever paints, so there's no
  // visible flash either way — this just gets there via an extra internal render instead
  const [size, setSize] = useState({ width: 0, height: 0 })

  // a layout effect, not a plain effect — it reads and corrects the real size synchronously
  // before the browser paints, so the very first frame the user sees is already right. A plain
  // effect (or the "assume roomy" fallback this replaced) let the wrong layout paint for one
  // real frame first: full desktop chrome flashing on a narrow phone screen before collapsing
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setSize(el.getBoundingClientRect())
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return {
    showsProjectName: size.width >= MIN_WIDTH.projectName,
    showsFullCredit:
      size.width >= MIN_WIDTH.fullCredit &&
      size.height >= MIN_HEIGHT_FOR_FULL_CREDIT,
    docksPanel: size.width < MIN_WIDTH.sidePanel,
  }
}
