// Pure viewport geometry for the map's pan/zoom. No React, no motion values — every function
// takes plain numbers so the gesture hook only has to worry about wiring events to state.

export type Point = { x: number; y: number }
export type Pan = { x: number; y: number }

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const distanceBetween = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y)

export const midpointOf = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

// the image sits in a square box sized to cover the viewport, so panning room is whatever that
// scaled square overhangs the viewport by — per axis, since a landscape viewport has vertical
// overhang even at 1x
export function clampPanToOverhang(
  pan: Pan,
  scale: number,
  rect: DOMRect,
): Pan {
  const scaledSide = Math.max(rect.width, rect.height) * scale
  const maxX = Math.max(0, (scaledSide - rect.width) / 2)
  const maxY = Math.max(0, (scaledSide - rect.height) / 2)
  return { x: clamp(pan.x, -maxX, maxX), y: clamp(pan.y, -maxY, maxY) }
}

// the pan that puts normalized point (nx, ny) — 0-1 each axis, top-left origin, the same space
// MapPin positions itself in — exactly at the viewport's center
export function panCenteredOn(
  nx: number,
  ny: number,
  scale: number,
  rect: DOMRect,
): Pan {
  const side = Math.max(rect.width, rect.height)
  return { x: -scale * (nx - 0.5) * side, y: -scale * (ny - 0.5) * side }
}

// the pan that brings normalized point (nx, ny) just inside the viewport with `margin` px to
// spare on every edge — the minimal shift from `pan` that does so, or `pan` itself when the
// point already sits inside, so a keyboard-focused pin keeps its surroundings rather than
// being yanked to the center. insetRight carves the undocked detail panel's width out of the
// reveal area, so a focused pin can't land hidden behind it. Overhang clamping stays with the
// caller: at the map's resting zoom one axis has no panning room at all, and this must not
// pretend otherwise
export function panToReveal(
  nx: number,
  ny: number,
  scale: number,
  rect: DOMRect,
  pan: Pan,
  margin: number,
  insetRight: number,
): Pan {
  const side = Math.max(rect.width, rect.height)
  // where the point sits on screen right now — the same layout math panCenteredOn inverts:
  // viewport center + scaled offset-from-image-center + pan
  const sx = rect.width / 2 + scale * (nx - 0.5) * side + pan.x
  const sy = rect.height / 2 + scale * (ny - 0.5) * side + pan.y
  const maxX = rect.width - margin - insetRight
  const maxY = rect.height - margin
  const dx = sx < margin ? margin - sx : sx > maxX ? maxX - sx : 0
  const dy = sy < margin ? margin - sy : sy > maxY ? maxY - sy : 0
  return { x: pan.x + dx, y: pan.y + dy }
}

// the pan that keeps `origin` (a screen point) over the same spot on the map while scale changes
// from `fromScale` to `toScale` — what makes the cursor or pinch centre feel anchored
export function panAnchoredAt(
  origin: Point,
  rect: DOMRect,
  pan: Pan,
  fromScale: number,
  toScale: number,
): Pan {
  const offsetX = origin.x - rect.left - rect.width / 2
  const offsetY = origin.y - rect.top - rect.height / 2
  const ratio = toScale / fromScale
  return {
    x: (pan.x - offsetX) * ratio + offsetX,
    y: (pan.y - offsetY) * ratio + offsetY,
  }
}
