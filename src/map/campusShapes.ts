import bundled from "./campusShapes.json"

// the hand drawn campus, in the pixel space of the satellite image (1312 x 1312)
export type Point = [number, number]
// a building is one or more rotated rectangles: centre x, centre y, width, height, angle in degrees
export type Rect = [cx: number, cy: number, w: number, h: number, a: number]
export type Building = {
  // the pin this building is, when it is one. Plenty of buildings have no pin
  id?: string
  r: Rect[]
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
}

export const ZONE_KINDS = ["field", "court", "parking"] as const
export const PATH_KINDS = ["walk", "dirt"] as const

export const BUNDLED_SHAPES = bundled as unknown as CampusShapes

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
  for (const item of list("buildings")) {
    const entry = item as { id?: unknown; r?: unknown }
    if (!Array.isArray(entry?.r) || entry.r.length < 1 || entry.r.length > 8)
      return null
    const r: Rect[] = []
    for (const rect of entry.r) {
      if (!Array.isArray(rect) || rect.length !== 5 || !rect.every(finite))
        return null
      const [cx, cy, w, h, a] = rect as number[]
      if (w <= 0 || h <= 0) return null
      r.push([round(cx), round(cy), round(w), round(h), round(a)])
    }
    const building: Building = { r }
    if (typeof entry.id === "string" && entry.id)
      building.id = entry.id.slice(0, 80)
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
  return { size: 1312, buildings, roads, paths, zones }
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
  for (const road of shapes.roads) {
    const d = smoothPath(road.p)
    body += `<path class="rc" stroke-width="${n(road.w + 2.4)}" d="${d}"/><path class="rr" stroke-width="${road.w}" d="${d}"/>`
  }
  for (const building of shapes.buildings) {
    const tag = building.id ? tagByPinId[building.id] : undefined
    const rects = building.r
      .map(
        ([cx, cy, w, h, a]) =>
          `<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" rx="1.2" transform="translate(${n(cx)} ${n(cy)}) rotate(${n(a)})"/>`,
      )
      .join("")
    body += `<g class="${tag ? `b b-${tag}` : "b"}">${rects}</g>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${shapes.size} ${shapes.size}" width="${shapes.size}" height="${shapes.size}"><style>${STYLE}</style>${body}</svg>\n`
}
