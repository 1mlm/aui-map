"use client"

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react"

// friction applied to the fling velocity every animation frame -- tuned by feel, not physics, to
// land somewhere between "stops dead" (1) and "never stops" (closer to 1)
const FLING_FRICTION_PER_FRAME = 0.94
const FLING_STOP_VELOCITY_PX_MS = 0.02

// drag-to-pan with momentum for a horizontally-scrollable element, shared by every wide flat
// panorama viewer in the app (the map's own PanoramaLayer scroller, and the capture flow's
// confirm-step preview). Touch already gets real native momentum scrolling for free from
// overflow-x-auto; this only steps in for mouse/pen, which have none of their own, tracking
// recent pointer speed and flinging scrollLeft on release with the same kind of decay a native
// touch scroll gives, so the two input methods end up feeling like the same viewer instead of a
// smooth one and a dead one
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const dragOrigin = useRef<{ pointerX: number; scrollLeft: number } | null>(
    null,
  )
  // last few samples of (time, scrollLeft) taken while dragging, just enough to get a release
  // velocity from -- overwritten every frame, never grows unbounded
  const velocitySamples = useRef<{ time: number; scrollLeft: number }[]>([])
  const flingFrame = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    return () => {
      if (flingFrame.current !== null) cancelAnimationFrame(flingFrame.current)
    }
  }, [])

  function stopFling() {
    if (flingFrame.current !== null) {
      cancelAnimationFrame(flingFrame.current)
      flingFrame.current = null
    }
  }

  function handlePointerDown(event: ReactPointerEvent<T>) {
    const el = ref.current
    // touch keeps its native drag-to-scroll (with the browser's own momentum) untouched -- this
    // handler only takes over for mouse/pen, which have no momentum of their own to fling with
    if (!el || event.pointerType === "touch") return
    stopFling()
    dragOrigin.current = { pointerX: event.clientX, scrollLeft: el.scrollLeft }
    velocitySamples.current = [
      { time: event.timeStamp, scrollLeft: el.scrollLeft },
    ]
    el.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  function handlePointerMove(event: ReactPointerEvent<T>) {
    const el = ref.current
    if (!el || !dragOrigin.current) return
    el.scrollLeft =
      dragOrigin.current.scrollLeft -
      (event.clientX - dragOrigin.current.pointerX)
    velocitySamples.current.push({
      time: event.timeStamp,
      scrollLeft: el.scrollLeft,
    })
    // only the last ~50ms matters for "how fast was the flick at the very end" -- older samples
    // would just average in a slower drag from earlier in the same gesture
    const cutoff = event.timeStamp - 50
    while (
      velocitySamples.current.length > 1 &&
      velocitySamples.current[0].time < cutoff
    )
      velocitySamples.current.shift()
  }

  // scrollLeft's own clamping at the native scroll bounds means this never needs to know how
  // wide the image is -- setting it past either edge is a no-op, which is exactly "stop the fling"
  function runFling(velocityPxPerMs: number) {
    const el = ref.current
    if (!el) return
    if (Math.abs(velocityPxPerMs) < FLING_STOP_VELOCITY_PX_MS) {
      flingFrame.current = null
      return
    }
    const before = el.scrollLeft
    el.scrollLeft += velocityPxPerMs * 16
    if (el.scrollLeft === before) {
      flingFrame.current = null
      return
    }
    flingFrame.current = requestAnimationFrame(() =>
      runFling(velocityPxPerMs * FLING_FRICTION_PER_FRAME),
    )
  }

  function handlePointerUp(event: ReactPointerEvent<T>) {
    if (!dragOrigin.current) return
    dragOrigin.current = null
    setDragging(false)
    try {
      ref.current?.releasePointerCapture(event.pointerId)
    } catch {}

    const samples = velocitySamples.current
    const first = samples[0]
    const last = samples.at(-1)
    if (first && last && last.time > first.time) {
      const velocity =
        (last.scrollLeft - first.scrollLeft) / (last.time - first.time)
      runFling(velocity)
    }
  }

  return {
    ref,
    dragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  }
}
