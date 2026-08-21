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
