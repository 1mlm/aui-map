// Generates src/map3d/buildingFootprints.json: an approximate real footprint polygon per pin,
// traced automatically off public/auimap-1312.webp instead of hand-drawn. For each pin, flood-fills
// outward from the pin's own pixel (matching the roof's own color, so it doesn't leak into
// surrounding trees/pavement/road), traces the resulting blob's boundary, and simplifies it to a
// small polygon. Not precise surveying — a real trace/modify tool is still the long-term plan (see
// the 3D map backlog entry) — but it's real building *shapes* (including concave, multi-wing
// outlines) instead of a generic rectangle per tag.
//
// Rerun with: npx tsx --env-file=.env.local scripts/trace-building-footprints.ts
import { writeFileSync } from "node:fs"
import { PrismaPg } from "@prisma/adapter-pg"
import sharp from "sharp"
import { PrismaClient } from "../src/generated/prisma/client"

const IMAGE_PATH = "public/auimap-1312.webp"
const OUTPUT_PATH = "src/map3d/buildingFootprints.json"

// same box public/auimap-1312.webp was cropped to — see src/map/geo.ts's MAP_BOUNDING_BOX
const MAP_BOUNDING_BOX = {
  topLat: 33.544681703557316,
  bottomLat: 33.53289291897234,
  leftLong: -5.11292362676454,
  rightLong: -5.098835929136081,
}
const METERS_PER_DEGREE_LATITUDE = 111_320
function metersPerDegreeLongitudeAt(latitude: number) {
  return METERS_PER_DEGREE_LATITUDE * Math.cos((latitude * Math.PI) / 180)
}
const MAP_METERS_SIZE = (() => {
  const { topLat, bottomLat, leftLong, rightLong } = MAP_BOUNDING_BOX
  const centerLat = (topLat + bottomLat) / 2
  return {
    widthMeters: (rightLong - leftLong) * metersPerDegreeLongitudeAt(centerLat),
    heightMeters: (topLat - bottomLat) * METERS_PER_DEGREE_LATITUDE,
  }
})()

function latLongToPixel(
  latitude: number,
  longitude: number,
  imageWidth: number,
  imageHeight: number,
) {
  const { topLat, bottomLat, leftLong, rightLong } = MAP_BOUNDING_BOX
  return {
    px: ((longitude - leftLong) / (rightLong - leftLong)) * imageWidth,
    py: ((latitude - topLat) / (bottomLat - topLat)) * imageHeight,
  }
}

type RGB = { r: number; g: number; b: number }

function readPixel(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number,
): RGB {
  const i = (y * width + x) * channels
  return { r: data[i], g: data[i + 1], b: data[i + 2] }
}

function colorDistance(a: RGB, b: RGB) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

function polygonArea(points: Point[]) {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

const FLOOD_RADIUS_PX = 55
const MIN_MASK_PIXELS = 20
// pixels touching the flood window's own edge mean the fill got clipped by the radius cap
// rather than stopping at a real color boundary — a sign it leaked, not a sign of a big building
const LEAK_EDGE_TOUCH_LIMIT = 3

// 8-connected flood fill from the pin's own pixel, bounded to a local window so it can't leak
// across the whole image, matched against the seed's own color rather than a fixed palette
function floodFillMask(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  seedX: number,
  seedY: number,
  colorThreshold: number,
) {
  const seedColor = readPixel(data, width, channels, seedX, seedY)
  const minX = Math.max(0, seedX - FLOOD_RADIUS_PX)
  const maxX = Math.min(width - 1, seedX + FLOOD_RADIUS_PX)
  const minY = Math.max(0, seedY - FLOOD_RADIUS_PX)
  const maxY = Math.min(height - 1, seedY + FLOOD_RADIUS_PX)

  const visited = new Set<string>()
  const queue: [number, number][] = [[seedX, seedY]]
  const mask = new Set<string>()
  let edgeTouches = 0

  while (queue.length > 0) {
    const [x, y] = queue.pop() as [number, number]
    const key = `${x},${y}`
    if (visited.has(key)) continue
    visited.add(key)
    if (x < minX || x > maxX || y < minY || y > maxY) continue
    const color = readPixel(data, width, channels, x, y)
    if (colorDistance(color, seedColor) > colorThreshold) continue
    mask.add(key)
    if (x === minX || x === maxX || y === minY || y === maxY) edgeTouches++
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ])
      queue.push([x + dx, y + dy])
  }
  return { mask, leaked: edgeTouches > LEAK_EDGE_TOUCH_LIMIT }
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const build = (pts: Point[]) => {
    const hull: Point[] = []
    for (const p of pts) {
      while (
        hull.length >= 2 &&
        cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0
      )
        hull.pop()
      hull.push(p)
    }
    hull.pop()
    return hull
  }
  const lower = build(sorted)
  const upper = build([...sorted].reverse())
  return [...lower, ...upper]
}

type Point = { x: number; y: number }

// Douglas-Peucker polyline simplification, closed-loop
function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length <= 4) return points
  const perpendicularDistance = (p: Point, a: Point, b: Point) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSq = dx * dx + dy * dy
    if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq
    const projX = a.x + t * dx
    const projY = a.y + t * dy
    return Math.hypot(p.x - projX, p.y - projY)
  }
  const recurse = (pts: Point[]): Point[] => {
    if (pts.length <= 2) return pts
    let maxDist = 0
    let maxIndex = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const dist = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1])
      if (dist > maxDist) {
        maxDist = dist
        maxIndex = i
      }
    }
    if (maxDist <= epsilon) return [pts[0], pts[pts.length - 1]]
    const left = recurse(pts.slice(0, maxIndex + 1))
    const right = recurse(pts.slice(maxIndex))
    return [...left.slice(0, -1), ...right]
  }
  return recurse(points)
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  const pins = await prisma.pin.findMany({
    select: { id: true, latitude: true, longitude: true },
  })
  await prisma.$disconnect()

  const image = sharp(IMAGE_PATH)
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const metersPerPixelX = MAP_METERS_SIZE.widthMeters / width
  const metersPerPixelZ = MAP_METERS_SIZE.heightMeters / height

  // stricter thresholds tried in order — a leaked/oversized first attempt gets retried tighter
  // before giving up and falling back
  const COLOR_THRESHOLDS = [30, 20, 12]
  const MAX_FOOTPRINT_DIAGONAL_METERS = 60
  const MIN_FOOTPRINT_SPAN_METERS = 3
  // a true rectangle fills 100% of its own bounding box, an ellipse ~78%; a jagged noise sliver
  // fills much less — rejecting low-fill hulls throws out the flood fill's obvious garbage
  const MIN_FILL_RATIO = 0.35

  const footprints: Record<
    string,
    { points: [number, number][]; fallback: boolean }
  > = {}
  let fallbackCount = 0

  for (const pin of pins) {
    const { px, py } = latLongToPixel(
      pin.latitude,
      pin.longitude,
      width,
      height,
    )
    const seedX = Math.round(px)
    const seedY = Math.round(py)

    let hull: Point[] | null = null
    for (const threshold of COLOR_THRESHOLDS) {
      const { mask, leaked } = floodFillMask(
        data,
        width,
        height,
        channels,
        seedX,
        seedY,
        threshold,
      )
      if (mask.size < MIN_MASK_PIXELS) continue
      const candidateHull = convexHull(
        [...mask].map((key) => {
          const [x, y] = key.split(",").map(Number)
          return { x, y }
        }),
      )
      const xSpanMeters =
        (Math.max(...candidateHull.map((p) => p.x)) -
          Math.min(...candidateHull.map((p) => p.x))) *
        metersPerPixelX
      const zSpanMeters =
        (Math.max(...candidateHull.map((p) => p.y)) -
          Math.min(...candidateHull.map((p) => p.y))) *
        metersPerPixelZ
      const largestSpanMeters = Math.max(xSpanMeters, zSpanMeters)
      const areaMeters =
        polygonArea(candidateHull) * metersPerPixelX * metersPerPixelZ
      const boundingBoxAreaMeters = xSpanMeters * zSpanMeters
      const fillRatio =
        boundingBoxAreaMeters > 0 ? areaMeters / boundingBoxAreaMeters : 0
      if (
        leaked ||
        largestSpanMeters > MAX_FOOTPRINT_DIAGONAL_METERS ||
        largestSpanMeters < MIN_FOOTPRINT_SPAN_METERS ||
        fillRatio < MIN_FILL_RATIO
      )
        continue
      hull = candidateHull
      break
    }

    if (!hull) {
      fallbackCount++
      footprints[pin.id] = { points: [], fallback: true }
      continue
    }

    const simplified = simplify(hull, 1.5)

    // pixel -> world meters, relative to the pin's own pixel (so the polygon is building-local,
    // matching how Building.tsx already positions a <group> at the pin's world center)
    const points: [number, number][] = simplified.map((p) => [
      Number(((p.x - px) * metersPerPixelX).toFixed(2)),
      Number(((p.y - py) * metersPerPixelZ).toFixed(2)),
    ])
    footprints[pin.id] = { points, fallback: false }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(footprints))
  console.log(
    `traced ${pins.length} pins, ${fallbackCount} fell back (mask too small) -> ${OUTPUT_PATH}`,
  )
}

main()
