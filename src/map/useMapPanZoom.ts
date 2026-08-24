"use client"

import { animate, useMotionValue } from "motion/react"
import { useEffect, useRef, useState } from "react"
import {
  clamp,
  clampPanToOverhang,
  distanceBetween,
  midpointOf,
  type Pan,
  panAnchoredAt,
  panCenteredOn,
  type Point,
} from "./panZoomMath"

// the image sits in a square box already sized to cover the viewport, so 1 is the smallest
// scale that still fills it — going below would let the page background show through. The map
// always opens at this scale, fully zoomed out, no matter the viewport's aspect ratio
const MIN_SCALE = 1
// pinching past MIN_SCALE stretches this far before springing back, android-overscroll style
const OVERZOOM_FLOOR = 0.9
const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5
// the scale pins render at their designed, undiminished size — set above MIN_SCALE on purpose,
// so pins start out a bit smaller than that at the fully-zoomed-out resting view than they'd
// otherwise be. Dense clusters (the dorms especially) don't have room for full-size pins at the
// scale everyone now opens the map at
const PIN_REFERENCE_SCALE = 4
// pins used to counter the zoom exactly (1/scale), which pinned them to one on-screen size no
// matter how far you'd zoomed in. Shrinking them slightly instead clears a little real room
// around a cluster without the icon itself getting hard to see; the actual room to read names
// comes from the map spreading pins further apart on screen as you zoom, not from the icon
// shrinking further than this. Tuned live via PinTuningPlayground's "shrink amount" slider
export const DEFAULT_PIN_GROWTH_EXPONENT = 0.3
const DOUBLE_TAP_MAX_DELAY_MS = 300
const DOUBLE_TAP_MAX_DISTANCE_PX = 24
const WHEEL_SETTLE_DELAY_MS = 220
const LIMIT_FLASH_MS = 180
// how long to keep pins' shadow filters off after the last non-animated scale change (wheel tick,
// pinch move) before assuming the gesture is done and turning them back on
const ZOOMING_FILTER_CLEAR_DELAY_MS = 200
const SNAP_SPRING = { type: "spring", stiffness: 260, damping: 26 } as const
// quick and snappy — this is a "found you" nudge on first load, not a gesture settling
const LOCATE_TRANSITION = {
  type: "tween",
  duration: 0.2,
  ease: "easeOut",
} as const

// the scale a pin has to apply to itself, from inside the zoomed map, to end up at that curve —
// normalised against PIN_REFERENCE_SCALE rather than the resting scale itself, so a pin is
// already partway down the shrink curve (not full pinBaseSizePx) at rest. growthExponent is
// only ever overridden by the dev-only PinTuningPlayground — real visitors always get the default
export const pinCounterScale = (
  mapScale: number,
  growthExponent: number = DEFAULT_PIN_GROWTH_EXPONENT,
) => (mapScale / PIN_REFERENCE_SCALE) ** growthExponent / mapScale

// pans/zooms the campus image inside a fixed-size viewport: wheel + trackpad pinch on desktop,
// one-finger drag + two-finger pinch on touch, double-click/double-tap to toggle zoom. All state
// lives in motion values so gestures update transforms without re-rendering React.
export function useMapPanZoom() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scale = useMotionValue(MIN_SCALE)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  // pins carry two stacked shadow filters each; re-rasterizing all of them on every frame the
  // viewport is moving is what actually makes panning/zooming janky. This flips off while a pan
  // or zoom gesture is live and back on once it settles, so the shadows are only ever missing
  // mid-motion, not at rest
  const isMoving = useMotionValue(0)
  const [hitLimit, setHitLimit] = useState(false)
  // true the moment the user first touches the map themselves — drag, pinch, wheel, or a tap that
  // lands on a pin. Read once, on the geolocation fix, to decide whether auto-centering on them
  // would still be welcome or would now just be yanking the view out from under them
  const hasInteracted = useRef(false)

  const activePointers = useRef(new Map<number, Point>())
  const panOrigin = useRef<{ pointer: Point; pan: Pan } | null>(null)
  const pinchOrigin = useRef<{
    distance: number
    scale: number
    midpoint: Point
    pan: Pan
  } | null>(null)
  const lastTap = useRef<{ time: number; point: Point } | null>(null)
  // tracked on every pointerdown so the right-click/long-press context menu (opened by Radix,
  // which doesn't hand back the triggering coordinate) can read where it was actually opened
  const lastPointerClientPosition = useRef<Point>({ x: 0, y: 0 })
  const wheelSettleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const limitFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomingFilterClearTimeout = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  // the container never scrolls and only resizes, so its rect is cached instead of re-measured
  // on every wheel tick and pointermove — getBoundingClientRect() forces a synchronous layout
  const rect = useRef<DOMRect | null>(null)

  const getPan = (): Pan => ({ x: x.get(), y: y.get() })
  const setPan = (pan: Pan) => {
    x.set(pan.x)
    y.set(pan.y)
  }

  function flashLimit() {
    if (limitFlashTimeout.current) clearTimeout(limitFlashTimeout.current)
    setHitLimit(true)
    limitFlashTimeout.current = setTimeout(
      () => setHitLimit(false),
      LIMIT_FLASH_MS,
    )
  }

  // for continuous, non-animated viewport changes (wheel ticks, pinch move, drag pan): flip
  // filters off now, and schedule them back on unless another change pushes the deadline out first
  function markMoving() {
    if (zoomingFilterClearTimeout.current)
      clearTimeout(zoomingFilterClearTimeout.current)
    isMoving.set(1)
    zoomingFilterClearTimeout.current = setTimeout(
      () => isMoving.set(0),
      ZOOMING_FILTER_CLEAR_DELAY_MS,
    )
  }

  // for an animated scale change (double-tap, settle-back spring): the debounce above would
  // restore the filters mid-spring, so this ties the clear to the animation's own completion
  function animateMoving(target: number) {
    if (zoomingFilterClearTimeout.current)
      clearTimeout(zoomingFilterClearTimeout.current)
    isMoving.set(1)
    animate(scale, target, SNAP_SPRING).then(() => isMoving.set(0))
  }

  // the one path every zoom interaction goes through: clamp the requested scale, keep `origin`
  // anchored under the cursor/fingers, then keep the pan inside the image
  function zoomTo(
    requestedScale: number,
    origin: Point,
    { animated = false } = {},
  ) {
    if (!rect.current) return
    const fromScale = scale.get()
    const toScale = clamp(requestedScale, OVERZOOM_FLOOR, MAX_SCALE)
    if (requestedScale > MAX_SCALE) flashLimit()
    if (toScale === fromScale) return

    const anchored = panAnchoredAt(
      origin,
      rect.current,
      getPan(),
      fromScale,
      toScale,
    )
    const pan = clampPanToOverhang(anchored, toScale, rect.current)

    if (!animated) {
      markMoving()
      scale.set(toScale)
      setPan(pan)
      return
    }
    animateMoving(toScale)
    animate(x, pan.x, SNAP_SPRING)
    animate(y, pan.y, SNAP_SPRING)
  }

  // a gesture can stretch past MIN_SCALE, but shouldn't rest there — spring back once it releases
  function settleScale() {
    if (!rect.current || scale.get() >= MIN_SCALE) return
    const pan = clampPanToOverhang(getPan(), MIN_SCALE, rect.current)
    animateMoving(MIN_SCALE)
    animate(x, pan.x, SNAP_SPRING)
    animate(y, pan.y, SNAP_SPRING)
  }

  // the one-time "found you" nudge: zooms in on and centers a normalized map point, quickly. Only
  // ever called for the user's own location, and only once — see hasInteracted above
  function centerOn([nx, ny]: [number, number]) {
    if (!rect.current) return
    const toScale = DOUBLE_TAP_SCALE
    const pan = clampPanToOverhang(
      panCenteredOn(nx, ny, toScale, rect.current),
      toScale,
      rect.current,
    )
    if (zoomingFilterClearTimeout.current)
      clearTimeout(zoomingFilterClearTimeout.current)
    isMoving.set(1)
    animate(scale, toScale, LOCATE_TRANSITION).then(() => isMoving.set(0))
    animate(x, pan.x, LOCATE_TRANSITION)
    animate(y, pan.y, LOCATE_TRANSITION)
  }

  function toggleZoom(origin: Point) {
    const isZoomedIn = scale.get() > MIN_SCALE + 0.1
    zoomTo(isZoomedIn ? MIN_SCALE : DOUBLE_TAP_SCALE, origin, {
      animated: true,
    })
  }

  // `rect` isn't known until the container is laid out, so it's measured on mount and kept
  // current on every resize — every gesture handler reads it from here rather than measuring
  // itself
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      rect.current = el.getBoundingClientRect()
    }
    measure()
    scale.set(MIN_SCALE)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [scale])

  // native listener: React's synthetic wheel handler is passive, so preventDefault() inside a
  // JSX onWheel prop silently fails and the page scrolls along with the zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handleWheel = (e: WheelEvent) => {
      hasInteracted.current = true
      e.preventDefault()
      // ctrlKey means a trackpad pinch rather than a scroll, which reports smaller deltas
      const delta = e.ctrlKey ? -e.deltaY * 0.02 : -e.deltaY * 0.01
      zoomTo(scale.get() * (1 + delta), { x: e.clientX, y: e.clientY })

      if (wheelSettleTimeout.current) clearTimeout(wheelSettleTimeout.current)
      wheelSettleTimeout.current = setTimeout(
        settleScale,
        WHEEL_SETTLE_DELAY_MS,
      )
    }
    el.addEventListener("wheel", handleWheel, { passive: false })
    return () => el.removeEventListener("wheel", handleWheel)
  })

  function handlePointerDown(e: React.PointerEvent) {
    hasInteracted.current = true
    // recorded before the early returns below — a long-press/right-click on a pin (itself a
    // button) still needs to open the context menu at the right coordinate
    lastPointerClientPosition.current = { x: e.clientX, y: e.clientY }

    // right/middle mouse buttons are for the context menu, not panning
    if (e.pointerType === "mouse" && e.button !== 0) return

    const startedOnButton = (e.target as HTMLElement).closest("button")
    // capturing a pointer that started on a pin would retarget its pointerup away from the
    // button and swallow the click, so it's left uncaptured — the button still gets the tap.
    // The position is tracked below regardless, so a second finger landing on a pin still
    // counts toward a pinch instead of being dropped
    if (!startedOnButton) e.currentTarget.setPointerCapture(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1) {
      // a lone touch on a pin should resolve as its own tap, not start a pan
      if (startedOnButton) return
      panOrigin.current = {
        pointer: { x: e.clientX, y: e.clientY },
        pan: getPan(),
      }
      return
    }
    if (activePointers.current.size === 2) {
      const [a, b] = [...activePointers.current.values()]
      pinchOrigin.current = {
        distance: distanceBetween(a, b),
        scale: scale.get(),
        midpoint: midpointOf(a, b),
        pan: getPan(),
      }
      panOrigin.current = null
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (!rect.current) return

    if (activePointers.current.size === 2 && pinchOrigin.current) {
      const pinch = pinchOrigin.current
      const [a, b] = [...activePointers.current.values()]
      const toScale = clamp(
        (pinch.scale * distanceBetween(a, b)) / pinch.distance,
        OVERZOOM_FLOOR,
        MAX_SCALE,
      )
      const anchored = panAnchoredAt(
        pinch.midpoint,
        rect.current,
        pinch.pan,
        pinch.scale,
        toScale,
      )
      markMoving()
      scale.set(toScale)
      setPan(clampPanToOverhang(anchored, toScale, rect.current))
      return
    }

    if (activePointers.current.size === 1 && panOrigin.current) {
      const { pointer, pan } = panOrigin.current
      const dragged = {
        x: pan.x + (e.clientX - pointer.x),
        y: pan.y + (e.clientY - pointer.y),
      }
      markMoving()
      setPan(clampPanToOverhang(dragged, scale.get(), rect.current))
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const releasePoint = { x: e.clientX, y: e.clientY }
    const wasSingleTap =
      activePointers.current.size === 1 &&
      panOrigin.current &&
      distanceBetween(panOrigin.current.pointer, releasePoint) <
        DOUBLE_TAP_MAX_DISTANCE_PX

    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size < 2) pinchOrigin.current = null

    const [remaining] = [...activePointers.current.values()]
    panOrigin.current = remaining ? { pointer: remaining, pan: getPan() } : null

    if (activePointers.current.size === 0) settleScale()
    if (wasSingleTap && e.pointerType === "touch")
      registerTap(releasePoint, e.timeStamp)
  }

  // touch has no dblclick event, so consecutive taps close together in time and space get
  // recognised as a double-tap by hand
  function registerTap(point: Point, time: number) {
    const previous = lastTap.current
    const isDoubleTap =
      previous &&
      time - previous.time < DOUBLE_TAP_MAX_DELAY_MS &&
      distanceBetween(previous.point, point) < DOUBLE_TAP_MAX_DISTANCE_PX

    if (isDoubleTap) {
      toggleZoom(point)
      lastTap.current = null
      return
    }
    lastTap.current = { time, point }
  }

  return {
    containerRef,
    scale,
    x,
    y,
    isMoving,
    hitLimit,
    hasInteracted,
    centerOn,
    getLastPointerClientPosition: () => lastPointerClientPosition.current,
    gestureHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onDoubleClick: (e: React.MouseEvent) =>
        toggleZoom({ x: e.clientX, y: e.clientY }),
    },
  }
}
