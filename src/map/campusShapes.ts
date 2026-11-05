import polygonClipping from "polygon-clipping"
import bundled from "./campusShapes.json"

// the hand drawn campus, in the pixel space of the satellite image (1312 x 1312)
export type Point = [number, number]
// a building is ONE continuous shape: either a rectangle shortcut (centre x, centre y, width, height,
// angle in degrees) or, when a rectangle won't do, a plain polygon of vertices. Never several pieces
export type Rect = [cx: number, cy: number, w: number, h: number, a: number]
export type Building = {
  // the pin this building is, when it is one. Plenty of buildings have no pin
  id?: string
  // exactly one of these two is set
  r?: Rect
  p?: Point[]
  // confirmed (fully drawn and polished). Missing means still a draft, which is what everything is
  // until someone confirms it in /admin/map
  done?: boolean
}
export type Road = { w: number; p: Point[] }
export type Path = { w: number; kind: "walk" | "dirt"; p: Point[] }
export type Zone = { kind: "field" | "court" | "parking"; p: Point[] }
export type CampusShapes = {
  size: number
  buildings: Building[]
  roads: Road[]
  paths: Path[]
  zones: Zone[]
  // pins that are marked as not needing a building (a field, a parking lot...), so they stop
  // showing up as "still to do" in /admin/map
  skipPins?: string[]
}

export const ZONE_KINDS = ["field", "court", "parking"] as const
export const PATH_KINDS = ["walk", "dirt"] as const

export function rectToPolygon([cx, cy, w, h, a]: Rect): Point[] {
  const rad = (a * Math.PI) / 180
  const ux = [Math.cos(rad), Math.sin(rad)]
  const uy = [-Math.sin(rad), Math.cos(rad)]
  const at = (lx: number, ly: number): Point => [
    cx + ux[0] * lx + uy[0] * ly,
    cy + ux[1] * lx + uy[1] * ly,
  ]
  return [
    at(-w / 2, -h / 2),
    at(w / 2, -h / 2),
    at(w / 2, h / 2),
    at(-w / 2, h / 2),
  ]
}

// the outline of several overlapping pieces as one polygon (what older saves, made of glued
// rectangles, turn into). Pieces that don't touch fall back to one outline around all of them
function unite(parts: Point[][]): Point[] | null {
  try {
    const [first, ...rest] = parts.map((pts) => [pts] as [Point[]])
    const merged = polygonClipping.union(first as never, ...(rest as never[]))
    if (merged.length === 1) return merged[0][0].slice(0, -1) as Point[]
  } catch {}
  // not one piece: the convex outline of everything
  const all = parts.flat().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Point, a: Point, b: Point) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const q of list) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], q) <= 0
      )
        out.pop()
      out.push(q)
    }
    return out.slice(0, -1)
  }
  const hull = [...half(all), ...half([...all].reverse())]
  return hull.length >= 3 ? hull : null
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)
const isPoint = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && value.every(finite)
const points = (value: unknown, min: number): Point[] | null =>
  Array.isArray(value) && value.length >= min && value.every(isPoint)
    ? (value as Point[])
    : null

// whatever comes in over the wire (or out of the db) is rebuilt field by field, so a bad save can
// never put something in the map that breaks the page
export function sanitizeShapes(input: unknown): CampusShapes | null {
  if (typeof input !== "object" || input === null) return null
  const raw = input as Record<string, unknown>
  const list = (key: string) =>
    Array.isArray(raw[key]) ? (raw[key] as unknown[]) : []
  const round = (value: number) => Math.round(value * 10) / 10

  const buildings: Building[] = []
  const asRect = (value: unknown): Rect | null => {
    if (!Array.isArray(value) || value.length !== 5 || !value.every(finite))
      return null
    const [cx, cy, w, h, a] = value as number[]
    return w > 0 && h > 0
      ? [round(cx), round(cy), round(w), round(h), round(a)]
      : null
  }
  for (const item of list("buildings")) {
    const entry = item as {
      id?: unknown
      r?: unknown
      p?: unknown
      done?: unknown
    }
    // the shapes a building has been saved as: a rectangle, a polygon, or (older saves) lists of
    // rectangles and polygons glued together, which become one outline
    const pieces: Point[][] = []
    let rect: Rect | null = null
    if (
      Array.isArray(entry?.r) &&
      entry.r.length === 5 &&
      entry.r.every(finite)
    ) {
      rect = asRect(entry.r)
      if (!rect) return null
    } else if (
      Array.isArray(entry?.r) &&
      entry.r.length === 1 &&
      !(Array.isArray(entry.p) && entry.p.length)
    ) {
      // an older save with a single rectangle: still a rectangle shortcut
      rect = asRect(entry.r[0])
      if (!rect) return null
    } else if (Array.isArray(entry?.r)) {
      for (const part of entry.r) {
        const r = asRect(part)
        if (!r) return null
        pieces.push(rectToPolygon(r))
      }
    }
    if (Array.isArray(entry?.p)) {
      if (
        entry.p.length &&
        Array.isArray(entry.p[0]) &&
        Array.isArray((entry.p[0] as unknown[])[0])
      ) {
        for (const poly of entry.p) {
          const pts = points(poly, 3)
          if (!pts) return null
          pieces.push(pts)
        }
      } else {
        const pts = points(entry.p, 3)
        if (!pts) return null
        pieces.push(pts)
      }
    }
    const building: Building = {}
    if (rect && pieces.length === 0) building.r = rect
    else {
      if (rect) pieces.push(rectToPolygon(rect))
      if (pieces.length === 0) return null
      const outline = pieces.length === 1 ? pieces[0] : unite(pieces)
      if (!outline) return null
      building.p = outline.map(([x, y]) => [round(x), round(y)])
    }
    if (typeof entry.id === "string" && entry.id)
      building.id = entry.id.slice(0, 80)
    if (entry.done === true) building.done = true
    buildings.push(building)
  }

  const roads: Road[] = []
  for (const item of list("roads")) {
    const entry = item as { w?: unknown; p?: unknown }
    const p = points(entry?.p, 2)
    if (!p || !finite(entry.w) || entry.w <= 0) return null
    roads.push({
      w: round(entry.w),
      p: p.map(([x, y]) => [round(x), round(y)]),
    })
  }
  const paths: Path[] = []
  for (const item of list("paths")) {
    const entry = item as { w?: unknown; kind?: unknown; p?: unknown }
    const p = points(entry?.p, 2)
    if (!p || !finite(entry.w) || entry.w <= 0) return null
    paths.push({
      w: round(entry.w),
      kind: entry.kind === "dirt" ? "dirt" : "walk",
      p: p.map(([x, y]) => [round(x), round(y)]),
    })
  }
  const zones: Zone[] = []
  for (const item of list("zones")) {
    const entry = item as { kind?: unknown; p?: unknown }
    const p = points(entry?.p, 3)
    if (!p) return null
    const kind = (ZONE_KINDS as readonly unknown[]).includes(entry.kind)
      ? (entry.kind as Zone["kind"])
      : "field"
    zones.push({ kind, p: p.map(([x, y]) => [round(x), round(y)]) })
  }
  if (buildings.length + roads.length + paths.length + zones.length > 2000)
    return null
  const skipPins = list("skipPins")
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map((id) => id.slice(0, 80))
    .slice(0, 300)
  return {
    size: 1312,
    buildings,
    roads,
    paths,
    zones,
    ...(skipPins.length ? { skipPins } : {}),
  }
}

// a smooth line through hand placed points (Catmull-Rom turned into cubic beziers)
export function smoothPath(pts: Point[]): string {
  const n = (v: number) => Math.round(v * 10) / 10
  if (pts.length < 3)
    return `M${pts.map((q) => `${n(q[0])} ${n(q[1])}`).join("L")}`
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p2[0])} ${n(p2[1])}`
  }
  return d
}

// the colours live in css so the picture follows the phone's light or dark setting, even as an <img>
const STYLE = `:root{--ground:#d9e2c8;--field:#a9d18f;--court:#d98a68;--parking:#c9ccd0;--casing:#b8b3a4;--road:#fffdf6;--walk:#f6eed9;--dirt:#d8bf92;--roof:#d9805f;--roofline:#9c4f38;--aud:#c9a45b;--food:#d8636a;--sport:#6fb36b}@media (prefers-color-scheme:dark){:root{--ground:#1c271f;--field:#2f4a2b;--court:#8a4a36;--parking:#363a3f;--casing:#171c18;--road:#3b403b;--walk:#4a4a42;--dirt:#5b4d36;--roof:#a85a40;--roofline:#6e3626;--aud:#8c7237;--food:#9c444a;--sport:#3f7a3d}}.zf{fill:var(--field)}.zc{fill:var(--court)}.zp{fill:var(--parking)}.rc{fill:none;stroke:var(--casing);stroke-linecap:round;stroke-linejoin:round}.rr{fill:none;stroke:var(--road);stroke-linecap:round;stroke-linejoin:round}.pw{fill:none;stroke:var(--walk);stroke-linecap:round;stroke-linejoin:round}.pd{fill:none;stroke:var(--dirt);stroke-linecap:round;stroke-linejoin:round}.b{fill:var(--roof);stroke:var(--roofline);stroke-width:.8}.b-auditorium{fill:var(--aud)}.b-food{fill:var(--food)}.b-sports{fill:var(--sport)}`

const ZONE_CLASS = { field: "zf", court: "zc", parking: "zp" } as const

// tagByPinId: pin slug -> its tag id, so a building linked to a pin takes that category's colour
export function buildCampusSvg(
  shapes: CampusShapes,
  tagByPinId: Record<string, string>,
): string {
  const n = (v: number) => Math.round(v * 10) / 10
  const polygon = (pts: Point[]) =>
    `M${pts.map((q) => `${n(q[0])} ${n(q[1])}`).join("L")}Z`
  let body = `<rect width="${shapes.size}" height="${shapes.size}" fill="var(--ground)"/>`
  for (const zone of shapes.zones)
    body += `<path class="${ZONE_CLASS[zone.kind]}" d="${polygon(zone.p)}"/>`
  for (const path of shapes.paths)
    body += `<path class="${path.kind === "dirt" ? "pd" : "pw"}" stroke-width="${path.w}" d="${smoothPath(path.p)}"/>`
  // every outline first, then every fill, so two roads that meet read as one joined road
  for (const road of shapes.roads)
    body += `<path class="rc" stroke-width="${n(road.w + 2.4)}" d="${smoothPath(road.p)}"/>`
  for (const road of shapes.roads)
    body += `<path class="rr" stroke-width="${road.w}" d="${smoothPath(road.p)}"/>`
  for (const building of shapes.buildings) {
    const tag = building.id ? tagByPinId[building.id] : undefined
    const cls = tag ? `b b-${tag}` : "b"
    if (building.r) {
      const [cx, cy, w, h, a] = building.r
      body += `<rect class="${cls}" x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="1.2" transform="translate(${n(cx)} ${n(cy)}) rotate(${n(a)})"/>`
    } else if (building.p)
      body += `<path class="${cls}" d="${polygon(building.p)}"/>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shapes.size} ${shapes.size}" width="${shapes.size}" height="${shapes.size}"><style>${STYLE}</style>${body}</svg>\n`
}

// the drawing that ships with the code, used until the first save
export const BUNDLED_SHAPES: CampusShapes = sanitizeShapes(bundled) ?? {
  size: 1312,
  buildings: [],
  roads: [],
  paths: [],
  zones: [],
}
