// biome-ignore-all lint/suspicious/noArrayIndexKey: shapes, parts and points have no ids, their position is their identity
"use client"

import {
  Add01Icon,
  Cancel01Icon,
  Copy01Icon,
  Cursor02Icon,
  Delete02Icon,
  FloppyDiskIcon,
  FootprintsIcon,
  Image01Icon,
  Link01Icon,
  MagnetIcon,
  MapPinIcon,
  Maximize01Icon,
  Pentagon01Icon,
  Road01Icon,
  SquareIcon,
  Tick02Icon,
  Tree01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import {
  type Building,
  type CampusShapes,
  PATH_KINDS,
  type Point,
  type Rect,
  smoothPath,
  ZONE_KINDS,
} from "@/map/campusShapes"
import { saveCampusShapes } from "./actions"

type Pin = { id: string; title: string; x: number; y: number }
type Layer = "buildings" | "roads" | "paths" | "zones"
type LineLayer = "roads" | "paths"
type Part = { k: "r" | "p"; j: number }
type Sel = { layer: Layer; i: number; part?: Part; v?: number }
type Tool = "select" | "poly" | "road" | "path" | "zone"
type View = { x: number; y: number; s: number }
type Snap = {
  pt: Point
  kind: "vertex" | "segment"
  layer: LineLayer
  i: number
  seg: number
}
type Drag =
  | { kind: "pan"; start: [number, number]; view: View; moved: boolean }
  | { kind: "move"; start: Point; orig: CampusShapes; sel: Sel; whole: boolean }
  | { kind: "vertex"; sel: Sel & { v: number } }
  | {
      kind: "rect"
      i: number
      j: number
      sx: -1 | 0 | 1
      sy: -1 | 0 | 1
      orig: Rect
    }
  | { kind: "rotate"; i: number; j: number }

const SIZE = 1312
// roads, paths and zones are put aside while the buildings get perfected. Flip this to bring their
// drawing tools back (their data, and the public map, are untouched either way)
const EDIT_LINES = false
const MIN_POINTS = { roads: 2, paths: 2, zones: 3, poly: 3 } as const
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

function axes(a: number) {
  const rad = (a * Math.PI) / 180
  return {
    ux: [Math.cos(rad), Math.sin(rad)],
    uy: [-Math.sin(rad), Math.cos(rad)],
  }
}
// a point given in a rectangle's own frame (x along its width, y along its height) in the drawing
function toWorld(rect: Rect, lx: number, ly: number): Point {
  const { ux, uy } = axes(rect[4])
  return [rect[0] + ux[0] * lx + uy[0] * ly, rect[1] + ux[1] * lx + uy[1] * ly]
}

// drag one side (sx / sy say which): the opposite side stays exactly where it is
function resizeRect(orig: Rect, p: Point, sx: number, sy: number): Rect {
  const [cx, cy, w, h, a] = orig
  const { ux, uy } = axes(a)
  const lx = (p[0] - cx) * ux[0] + (p[1] - cy) * ux[1]
  const ly = (p[0] - cx) * uy[0] + (p[1] - cy) * uy[1]
  const MIN = 2
  let nw = w
  let nh = h
  let shiftX = 0
  let shiftY = 0
  if (sx === 1) {
    nw = Math.max(MIN, lx + w / 2)
    shiftX = -w / 2 + nw / 2
  } else if (sx === -1) {
    nw = Math.max(MIN, w / 2 - lx)
    shiftX = w / 2 - nw / 2
  }
  if (sy === 1) {
    nh = Math.max(MIN, ly + h / 2)
    shiftY = -h / 2 + nh / 2
  } else if (sy === -1) {
    nh = Math.max(MIN, h / 2 - ly)
    shiftY = h / 2 - nh / 2
  }
  return [
    cx + ux[0] * shiftX + uy[0] * shiftY,
    cy + ux[1] * shiftX + uy[1] * shiftY,
    nw,
    nh,
    a,
  ]
}

function rectToPolygon(rect: Rect): Point[] {
  const [, , w, h] = rect
  return [
    toWorld(rect, -w / 2, -h / 2),
    toWorld(rect, w / 2, -h / 2),
    toWorld(rect, w / 2, h / 2),
    toWorld(rect, -w / 2, h / 2),
  ]
}

// the middle of a building's outline, where its name goes
function buildingCenter(b: Building): Point {
  const all: Point[] = [
    ...b.r.flatMap((r) => rectToPolygon(r)),
    ...(b.p ?? []).flat(),
  ]
  const xs = all.map((q) => q[0])
  const ys = all.map((q) => q[1])
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
}

function pointsOf(shapes: CampusShapes, sel: Sel): Point[] | null {
  if (sel.layer === "buildings")
    return shapes.buildings[sel.i]?.p?.[sel.part?.j ?? -1] ?? null
  return shapes[sel.layer][sel.i]?.p ?? null
}
const isClosed = (sel: Sel) =>
  sel.layer === "zones" || sel.layer === "buildings"
const minPointsFor = (sel: Sel) =>
  sel.layer === "buildings" ? 3 : MIN_POINTS[sel.layer]

const ALL_TOOLS: { tool: Tool; icon: HugeIcon; label: string; hint: string }[] =
  [
    {
      tool: "select",
      icon: Cursor02Icon,
      label: "Select",
      hint: "Click a shape to edit it",
    },
    {
      tool: "poly",
      icon: Pentagon01Icon,
      label: "Polygon building",
      hint: "Click each corner. Double-click, Enter or the tick finishes",
    },
    {
      tool: "road",
      icon: Road01Icon,
      label: "Road",
      hint: "Click points. Start or end on another road to connect. Double-click finishes",
    },
    {
      tool: "path",
      icon: FootprintsIcon,
      label: "Path",
      hint: "Click points. Start or end on a road or path to connect. Double-click finishes",
    },
    {
      tool: "zone",
      icon: Tree01Icon,
      label: "Zone",
      hint: "Click each corner of the field, court or parking. Double-click finishes",
    },
  ]

const TOOLS = EDIT_LINES
  ? ALL_TOOLS
  : ALL_TOOLS.filter((t) => t.tool === "select" || t.tool === "poly")

function IconBtn({
  icon,
  label,
  onClick,
  active,
  disabled,
  tone,
  showLabel,
}: {
  icon: HugeIcon
  label: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tone?: "primary" | "danger"
  showLabel?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
        tone === "primary"
          ? "bg-primary font-semibold text-primary-foreground"
          : tone === "danger"
            ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
            : active
              ? "bg-foreground text-background"
              : "bg-foreground/10 hover:bg-foreground/20"
      }`}
    >
      <Icon icon={icon} className="size-4" />
      {showLabel && <span>{label}</span>}
    </button>
  )
}

export function MapEditor({
  initial,
  pins,
}: {
  initial: CampusShapes
  pins: Pin[]
}) {
  const [shapes, setShapes] = useState<CampusShapes>(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [sel, setSel] = useState<Sel | null>(null)
  const [tool, setTool] = useState<Tool>("select")
  const [draft, setDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [snapOn, setSnapOn] = useState(true)
  const [snapView, setSnapView] = useState<Snap | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, s: SIZE })
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.8)
  const [showPins, setShowPins] = useState(true)
  // names inside buildings: only where they fit (auto), everywhere, or not at all
  const [names, _setNames] = useState<"auto" | "all" | "off">("auto")
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const snapRef = useRef<Snap | null>(null)
  const downAt = useRef<[number, number] | null>(null)

  const dirty = JSON.stringify(shapes) !== saved
  // one screen pixel in drawing units, so handles keep their size at any zoom
  const px = view.s / pxWidth
  const handleR = px * 7
  const stroke = px * 1.4

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPxWidth(el.clientWidth || 800))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // wheel zoom around the pointer (React's onWheel is passive, this one has to stop the page scroll)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    function onWheel(event: WheelEvent) {
      event.preventDefault()
      const at = toSvg(event)
      zoomAt(at, event.deltaY > 0 ? 1.15 : 1 / 1.15)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName))
        return
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault()
        undo()
      } else if (event.key === "Escape") {
        if (tool !== "select") cancelDraw()
        else setSel(null)
      } else if (event.key === "Enter" && tool !== "select") {
        finishDraw()
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        if (tool !== "select") setDraft((d) => d.slice(0, -1))
        else removeSelected()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function toSvg(event: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return [0, 0]
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const p = point.matrixTransform(ctm.inverse())
    return [p.x, p.y]
  }

  function zoomAt(at: Point, factor: number) {
    setView((v) => {
      const s = Math.min(SIZE * 1.2, Math.max(60, v.s * factor))
      const k = s / v.s
      return { s, x: at[0] - (at[0] - v.x) * k, y: at[1] - (at[1] - v.y) * k }
    })
  }

  function remember() {
    setHistory((h) => [...h.slice(-59), clone(shapes)])
  }
  function undo() {
    setHistory((h) => {
      const last = h[h.length - 1]
      if (last) {
        setShapes(last)
        setSel(null)
      }
      return h.slice(0, -1)
    })
  }
  function change(fn: (draft: CampusShapes) => void) {
    remember()
    setShapes((current) => {
      const next = clone(current)
      fn(next)
      return next
    })
  }

  // ---- connecting roads and paths ----
  // the nearest existing road or path point (or spot along one) to where the pointer is
  function findSnap(
    p: Point,
    exclude?: { layer: LineLayer; i: number; v: number },
  ): Snap | null {
    if (!snapOn) return null
    const reach = px * 10
    let best: Snap | null = null
    let bestDist = reach
    for (const layer of ["roads", "paths"] as const) {
      shapes[layer].forEach((line, i) => {
        line.p.forEach((q, v) => {
          if (
            exclude &&
            exclude.layer === layer &&
            exclude.i === i &&
            exclude.v === v
          )
            return
          const d = dist(p, q)
          if (d < bestDist) {
            bestDist = d
            best = { pt: q, kind: "vertex", layer, i, seg: v }
          }
        })
      })
    }
    if (best) return best
    bestDist = reach * 0.8
    for (const layer of ["roads", "paths"] as const) {
      shapes[layer].forEach((line, i) => {
        for (let seg = 0; seg < line.p.length - 1; seg++) {
          if (exclude && exclude.layer === layer && exclude.i === i) continue
          const a = line.p[seg]
          const b = line.p[seg + 1]
          const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1
          const t = Math.max(
            0,
            Math.min(
              1,
              ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) /
                len2,
            ),
          )
          const q: Point = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]
          const d = dist(p, q)
          if (d < bestDist) {
            bestDist = d
            best = { pt: q, kind: "segment", layer, i, seg }
          }
        }
      })
    }
    return best
  }

  // ---- drawing ----
  function startTool(next: Tool) {
    setDraft([])
    setSnapView(null)
    setTool(next)
    setSel(null)
  }
  function cancelDraw() {
    setDraft([])
    setSnapView(null)
    setTool("select")
  }
  function finishDraw() {
    // a double click already added the point twice
    const pts = draft.filter(
      (q, i) => i === 0 || dist(q, draft[i - 1]) > px * 2,
    )
    const need = tool === "road" || tool === "path" ? 2 : 3
    if (tool === "select" || pts.length < need) {
      cancelDraw()
      return
    }
    remember()
    // a road that ends on the middle of another road joins it for real: that road gets the point too
    const joins = [findSnap(pts[0]), findSnap(pts[pts.length - 1])].filter(
      (s): s is Snap => !!s && s.kind === "segment",
    )
    const next = clone(shapes)
    if (tool === "road") next.roads.push({ w: 6, p: pts })
    else if (tool === "path") next.paths.push({ w: 4, kind: "walk", p: pts })
    else if (tool === "zone") next.zones.push({ kind: "field", p: pts })
    else next.buildings.push({ r: [], p: [pts] })
    if (tool === "road" || tool === "path")
      for (const j of joins) insertJunction(next, j)
    setShapes(next)
    setSel(
      tool === "road"
        ? { layer: "roads", i: next.roads.length - 1 }
        : tool === "path"
          ? { layer: "paths", i: next.paths.length - 1 }
          : tool === "zone"
            ? { layer: "zones", i: next.zones.length - 1 }
            : {
                layer: "buildings",
                i: next.buildings.length - 1,
                part: { k: "p", j: 0 },
              },
    )
    cancelDraw()
  }
  function insertJunction(target: CampusShapes, snap: Snap) {
    const pts = target[snap.layer][snap.i].p
    if (!pts.some((q) => dist(q, snap.pt) < 0.5))
      pts.splice(snap.seg + 1, 0, [snap.pt[0], snap.pt[1]])
  }

  function addRect(to?: number) {
    const rect: Rect = [view.x + view.s / 2, view.y + view.s / 2, 24, 16, 0]
    remember()
    setShapes((current) => {
      const next = clone(current)
      if (to === undefined) {
        next.buildings.push({ r: [rect] })
      } else {
        const base = next.buildings[to].r[0] ?? next.buildings[to].p?.[0]?.[0]
        if (base && Array.isArray(base) && base.length === 5) {
          rect[0] = base[0] + 12
          rect[1] = base[1] + 12
        }
        next.buildings[to].r.push(rect)
      }
      return next
    })
    const index = to ?? shapes.buildings.length
    const j = to === undefined ? 0 : shapes.buildings[to].r.length
    setSel({ layer: "buildings", i: index, part: { k: "r", j } })
  }

  function removeSelected() {
    if (!sel) return
    if (sel.v !== undefined) {
      const pts = pointsOf(shapes, sel)
      if (pts && pts.length > minPointsFor(sel)) {
        change((d) => {
          const target = pointsOf(d, sel)
          target?.splice(sel.v as number, 1)
        })
        setSel({ ...sel, v: undefined })
        return
      }
    }
    change((d) => (d[sel.layer] as unknown[]).splice(sel.i, 1))
    setSel(null)
  }

  // ---- pointer handling ----
  function onBackgroundDown(event: React.PointerEvent) {
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    downAt.current = [event.clientX, event.clientY]
    drag.current = {
      kind: "pan",
      start: [event.clientX, event.clientY],
      view,
      moved: false,
    }
  }

  function startMove(event: React.PointerEvent, next: Sel) {
    if (tool !== "select") return
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel(next)
    drag.current = {
      kind: "move",
      start: toSvg(event),
      orig: clone(shapes),
      sel: next,
      whole: event.shiftKey,
    }
  }

  function startHandle(event: React.PointerEvent, d: Drag) {
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    drag.current = d
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current
    const p = toSvg(event)
    if (tool !== "select") {
      const snap = tool === "road" || tool === "path" ? findSnap(p) : null
      setSnapView(snap)
      setCursor(snap ? snap.pt : p)
    }
    if (!d) return
    if (d.kind === "pan") {
      if (
        Math.hypot(event.clientX - d.start[0], event.clientY - d.start[1]) > 4
      )
        d.moved = true
      if (!d.moved) return
      const k = d.view.s / pxWidth
      setView({
        s: d.view.s,
        x: d.view.x - (event.clientX - d.start[0]) * k,
        y: d.view.y - (event.clientY - d.start[1]) * k,
      })
      return
    }
    if (d.kind === "move") {
      const dx = p[0] - d.start[0]
      const dy = p[1] - d.start[1]
      const next = clone(d.orig)
      const { layer, i, part } = d.sel
      if (layer === "buildings") {
        const b = next.buildings[i]
        const moveRect = (r: Rect) => {
          r[0] += dx
          r[1] += dy
        }
        const movePoly = (pts: Point[]) => {
          for (const q of pts) {
            q[0] += dx
            q[1] += dy
          }
        }
        if (d.whole || !part) {
          b.r.forEach(moveRect)
          b.p?.forEach(movePoly)
        } else if (part.k === "r") moveRect(b.r[part.j])
        else if (b.p) movePoly(b.p[part.j])
      } else {
        for (const q of next[layer][i].p) {
          q[0] += dx
          q[1] += dy
        }
      }
      setShapes(next)
    } else if (d.kind === "vertex") {
      const { layer, i, v } = d.sel
      const isLine = layer === "roads" || layer === "paths"
      const snap = isLine ? findSnap(p, { layer, i, v }) : null
      snapRef.current = snap
      setSnapView(snap)
      const at = snap ? snap.pt : p
      setShapes((current) => {
        const next = clone(current)
        const pts = pointsOf(next, d.sel)
        if (pts) pts[v] = [at[0], at[1]]
        return next
      })
    } else if (d.kind === "rect") {
      setShapes((current) => {
        const next = clone(current)
        next.buildings[d.i].r[d.j] = resizeRect(d.orig, p, d.sx, d.sy)
        return next
      })
    } else if (d.kind === "rotate") {
      setShapes((current) => {
        const next = clone(current)
        const rect = next.buildings[d.i].r[d.j]
        rect[4] =
          (Math.atan2(p[1] - rect[1], p[0] - rect[0]) * 180) / Math.PI + 90
        return next
      })
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    if (d?.kind === "pan" && !d.moved) {
      // a plain click on empty space
      if (tool === "select") setSel(null)
      else {
        const p = toSvg(event)
        const snap = tool === "road" || tool === "path" ? findSnap(p) : null
        const at = snap ? snap.pt : p
        // clicking the first corner again closes a polygon
        if (
          draft.length >= 3 &&
          tool !== "road" &&
          tool !== "path" &&
          dist(at, draft[0]) < px * 10
        )
          finishDraw()
        else setDraft((current) => [...current, [at[0], at[1]]])
      }
    }
    if (d?.kind === "vertex") {
      const snap = snapRef.current
      // dropped on the middle of another road: that road gets a point there too, so they really join
      if (snap && snap.kind === "segment")
        setShapes((current) => {
          const next = clone(current)
          insertJunction(next, snap)
          return next
        })
    }
    snapRef.current = null
    setSnapView(null)
  }

  async function save() {
    setSaving(true)
    setStatus("")
    const result = await saveCampusShapes(shapes)
    setSaving(false)
    if ("error" in result) setStatus(result.error)
    else {
      setSaved(JSON.stringify(shapes))
      setStatus("Saved. The public map updates within a minute.")
    }
  }

  function linkPin(pinId: string) {
    if (sel?.layer !== "buildings") return
    change((d) => {
      // a pin is one building: take it from any other first
      for (const b of d.buildings) if (b.id === pinId) delete b.id
      if (pinId) d.buildings[sel.i].id = pinId
      else delete d.buildings[sel.i].id
    })
  }

  const building: Building | null =
    sel?.layer === "buildings" ? (shapes.buildings[sel.i] ?? null) : null
  const selectedRect: Rect | null =
    building && sel?.part?.k === "r" ? (building.r[sel.part.j] ?? null) : null
  const linkedIds = new Set(shapes.buildings.map((b) => b.id).filter(Boolean))
  const unlinkedPins = pins.filter((pin) => !linkedIds.has(pin.id))
  const activeTool = TOOLS.find((t) => t.tool === tool)

  function setRectField(index: number, value: number) {
    if (!sel || !selectedRect || Number.isNaN(value)) return
    change((d) => {
      const r = d.buildings[sel.i].r[(sel.part as Part).j]
      r[index] = index === 2 || index === 3 ? Math.max(2, value) : value
    })
  }

  function partChips() {
    if (!building) return []
    return [
      ...building.r.map((_, j) => ({
        part: { k: "r", j } as Part,
        label: `Rect ${j + 1}`,
      })),
      ...(building.p ?? []).map((_, j) => ({
        part: { k: "p", j } as Part,
        label: `Shape ${j + 1}`,
      })),
    ]
  }

  // ---- drawing the handles of whatever is selected ----
  function rectHandles(i: number, j: number, rect: Rect) {
    const [, , w, h, a] = rect
    const edge = (lx: number, ly: number, sx: -1 | 0 | 1, sy: -1 | 0 | 1) => {
      const [x, y] = toWorld(rect, lx, ly)
      const horizontal = sy !== 0 // top / bottom edges are wide, left / right edges are tall
      return (
        <rect
          key={`e${sx}${sy}`}
          x={-handleR * (horizontal ? 1.6 : 0.8)}
          y={-handleR * (horizontal ? 0.8 : 1.6)}
          width={handleR * (horizontal ? 3.2 : 1.6)}
          height={handleR * (horizontal ? 1.6 : 3.2)}
          rx={handleR * 0.7}
          transform={`translate(${x} ${y}) rotate(${a})`}
          fill="#fff"
          stroke="#06b6d4"
          strokeWidth={stroke}
          style={{ cursor: horizontal ? "ns-resize" : "ew-resize" }}
          onPointerDown={(e) =>
            startHandle(e, { kind: "rect", i, j, sx, sy, orig: clone(rect) })
          }
        />
      )
    }
    const corner = (lx: number, ly: number, sx: -1 | 1, sy: -1 | 1) => {
      const [x, y] = toWorld(rect, lx, ly)
      return (
        <circle
          key={`c${sx}${sy}`}
          cx={x}
          cy={y}
          r={handleR}
          fill="#06b6d4"
          stroke="#fff"
          strokeWidth={stroke}
          style={{ cursor: "nwse-resize" }}
          onPointerDown={(e) =>
            startHandle(e, { kind: "rect", i, j, sx, sy, orig: clone(rect) })
          }
        />
      )
    }
    const top = toWorld(rect, 0, -h / 2 - px * 26)
    const topEdge = toWorld(rect, 0, -h / 2)
    return (
      <g>
        {edge(w / 2, 0, 1, 0)}
        {edge(-w / 2, 0, -1, 0)}
        {edge(0, h / 2, 0, 1)}
        {edge(0, -h / 2, 0, -1)}
        {corner(w / 2, h / 2, 1, 1)}
        {corner(-w / 2, h / 2, -1, 1)}
        {corner(w / 2, -h / 2, 1, -1)}
        {corner(-w / 2, -h / 2, -1, -1)}
        <line
          x1={topEdge[0]}
          y1={topEdge[1]}
          x2={top[0]}
          y2={top[1]}
          stroke="#f59e0b"
          strokeWidth={stroke}
        />
        <circle
          cx={top[0]}
          cy={top[1]}
          r={handleR}
          fill="#f59e0b"
          stroke="#fff"
          strokeWidth={stroke}
          style={{ cursor: "grab" }}
          onPointerDown={(e) => startHandle(e, { kind: "rotate", i, j })}
        />
      </g>
    )
  }

  function pointHandles(s: Sel) {
    const pts = pointsOf(shapes, s)
    if (!pts) return null
    const closed = isClosed(s)
    return (
      <g>
        {pts.map((q, v) => {
          const next = pts[v + 1] ?? (closed ? pts[0] : null)
          if (!next) return null
          const mid: Point = [(q[0] + next[0]) / 2, (q[1] + next[1]) / 2]
          return (
            <circle
              key={`m${v}`}
              cx={mid[0]}
              cy={mid[1]}
              r={handleR * 0.65}
              fill="#fff"
              fillOpacity={0.85}
              stroke="#06b6d4"
              strokeWidth={stroke}
              style={{ cursor: "copy" }}
              onPointerDown={(e) => {
                // a new point in the middle of that stretch, picked up straight away
                e.stopPropagation()
                remember()
                setShapes((current) => {
                  const next2 = clone(current)
                  pointsOf(next2, s)?.splice(v + 1, 0, mid)
                  return next2
                })
                ;(svgRef.current as SVGSVGElement).setPointerCapture(
                  e.pointerId,
                )
                const picked = { ...s, v: v + 1 }
                drag.current = { kind: "vertex", sel: picked }
                setSel(picked)
              }}
            />
          )
        })}
        {pts.map((q, v) => (
          <circle
            key={`v${v}`}
            cx={q[0]}
            cy={q[1]}
            r={handleR}
            fill={s.v === v ? "#f43f5e" : "#06b6d4"}
            stroke="#fff"
            strokeWidth={stroke}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              const picked = { ...s, v }
              setSel(picked)
              startHandle(e, { kind: "vertex", sel: picked })
            }}
            onDoubleClick={() => removeSelected()}
          />
        ))}
      </g>
    )
  }

  const draftPoints = cursor && draft.length ? [...draft, cursor] : draft
  const selectedStroke = "#06b6d4"

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col gap-2 p-2 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {/* tools */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TOOLS.map((t) => (
            <IconBtn
              key={t.tool}
              icon={t.icon}
              label={t.label}
              showLabel
              active={tool === t.tool}
              onClick={() => startTool(t.tool)}
            />
          ))}
          <IconBtn
            icon={SquareIcon}
            label="Rectangle building"
            showLabel
            onClick={() => addRect()}
          />
          <span className="mx-1 h-6 w-px bg-border" />
          <IconBtn
            icon={Undo02Icon}
            label="Undo"
            onClick={undo}
            disabled={history.length === 0}
          />
          {EDIT_LINES && (
            <IconBtn
              icon={MagnetIcon}
              label="Snap roads together"
              active={snapOn}
              onClick={() => setSnapOn((v) => !v)}
            />
          )}
          <IconBtn
            icon={MapPinIcon}
            label="Show pins"
            active={showPins}
            onClick={() => setShowPins((v) => !v)}
          />
          <IconBtn
            icon={Maximize01Icon}
            label="Fit the whole map"
            onClick={() => setView({ x: 0, y: 0, s: SIZE })}
          />
          <label
            className="flex items-center gap-1.5 px-1 text-sm"
            title="Satellite photo"
          >
            <Icon icon={Image01Icon} className="size-4" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={satOpacity}
              onChange={(e) => setSatOpacity(Number(e.target.value))}
              className="w-24"
            />
          </label>
          <span className="ml-auto flex items-center gap-2">
            {status && (
              <span className="text-muted-foreground text-xs">{status}</span>
            )}
            <IconBtn
              icon={FloppyDiskIcon}
              label={saving ? "Saving…" : dirty ? "Save" : "Saved"}
              showLabel
              tone="primary"
              onClick={save}
              disabled={!dirty || saving}
            />
          </span>
        </div>

        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
            className="size-full touch-none rounded-2xl bg-neutral-900"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => tool !== "select" && finishDraw()}
          >
            <title>Campus drawing</title>
            <rect
              x={-2000}
              y={-2000}
              width={6000}
              height={6000}
              fill="transparent"
              onPointerDown={onBackgroundDown}
            />
            <image
              href="/auimap-1312.avif"
              width={SIZE}
              height={SIZE}
              opacity={satOpacity}
              pointerEvents="none"
            />

            {EDIT_LINES && (
              <>
                {shapes.zones.map((zone, i) => (
                  <polygon
                    key={i}
                    points={zone.p.map((q) => q.join(",")).join(" ")}
                    fill={
                      zone.kind === "court"
                        ? "#d98a68"
                        : zone.kind === "parking"
                          ? "#c9ccd0"
                          : "#a9d18f"
                    }
                    fillOpacity={0.55}
                    stroke={
                      sel?.layer === "zones" && sel.i === i
                        ? selectedStroke
                        : "#ffffff"
                    }
                    strokeWidth={stroke}
                    onPointerDown={(e) => startMove(e, { layer: "zones", i })}
                  />
                ))}
                {(["paths", "roads"] as const).map((layer) =>
                  shapes[layer].map((line, i) => {
                    const selected = sel?.layer === layer && sel.i === i
                    const d = smoothPath(line.p)
                    return (
                      <g key={`${layer}${i}`}>
                        <path
                          d={d}
                          fill="none"
                          stroke={
                            selected
                              ? selectedStroke
                              : layer === "roads"
                                ? "#ffffff"
                                : "#f0d9a8"
                          }
                          strokeOpacity={0.9}
                          strokeWidth={Math.max(line.w, px * 5)}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pointerEvents="none"
                        />
                        {/* a wider invisible stroke, so a thin road is easy to grab */}
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={Math.max(line.w, px * 16)}
                          strokeLinecap="round"
                          pointerEvents="stroke"
                          onPointerDown={(e) => startMove(e, { layer, i })}
                        />
                      </g>
                    )
                  }),
                )}
              </>
            )}
            {shapes.buildings.map((b, i) => {
              const selected = sel?.layer === "buildings" && sel.i === i
              const fill = b.id ? "#ff7a45" : "#facc15"
              const partStroke = (k: "r" | "p", j: number) =>
                selected && sel?.part?.k === k && sel.part.j === j
                  ? stroke * 2.4
                  : stroke
              return (
                <g
                  key={i}
                  fill={fill}
                  fillOpacity={0.55}
                  stroke={selected ? selectedStroke : "#ffffff"}
                >
                  {b.r.map((rect, j) => (
                    <rect
                      key={`r${j}`}
                      x={-rect[2] / 2}
                      y={-rect[3] / 2}
                      width={rect[2]}
                      height={rect[3]}
                      transform={`translate(${rect[0]} ${rect[1]}) rotate(${rect[4]})`}
                      strokeWidth={partStroke("r", j)}
                      onPointerDown={(e) =>
                        startMove(e, {
                          layer: "buildings",
                          i,
                          part: { k: "r", j },
                        })
                      }
                    />
                  ))}
                  {(b.p ?? []).map((pts, j) => (
                    <polygon
                      key={`p${j}`}
                      points={pts.map((q) => q.join(",")).join(" ")}
                      strokeWidth={partStroke("p", j)}
                      onPointerDown={(e) =>
                        startMove(e, {
                          layer: "buildings",
                          i,
                          part: { k: "p", j },
                        })
                      }
                    />
                  ))}
                </g>
              )
            })}

            {/* every building says which pin it is, right inside it */}
            {shapes.buildings.map((b, i) => {
              if (names === "off") return null
              const [cx, cy] = buildingCenter(b)
              const title = b.id
                ? (pins.find((pin) => pin.id === b.id)?.title ?? b.id)
                : "no pin"
              const shown = title.length > 20 ? `${title.slice(0, 19)}…` : title
              // in auto, a name only shows once its building is big enough on screen to hold it
              const xs = b.r
                .flatMap((r) => rectToPolygon(r))
                .concat((b.p ?? []).flat())
                .map((q) => q[0])
              const widthPx = (Math.max(...xs) - Math.min(...xs)) / px
              if (names === "auto" && widthPx < shown.length * 5.6) return null
              return (
                <text
                  key={`label${i}`}
                  x={cx}
                  y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={px * 11}
                  fontWeight={600}
                  fill={b.id ? "#ffffff" : "#fde047"}
                  stroke="#000000"
                  strokeWidth={px * 3}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {shown}
                </text>
              )
            })}

            {showPins &&
              pins.map((pin) => (
                <g
                  key={pin.id}
                  onPointerDown={(e) => {
                    if (sel?.layer === "buildings" && tool === "select") {
                      e.stopPropagation()
                      linkPin(pin.id)
                    }
                  }}
                  style={{
                    cursor: sel?.layer === "buildings" ? "pointer" : "default",
                  }}
                >
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={handleR * 0.7}
                    fill={linkedIds.has(pin.id) ? "#22c55e" : "#ef4444"}
                    stroke="#fff"
                    strokeWidth={stroke}
                  />
                  {!linkedIds.has(pin.id) && (
                    <text
                      x={pin.x + handleR}
                      y={pin.y + handleR * 0.4}
                      fontSize={px * 11}
                      fill="#fca5a5"
                      stroke="#000"
                      strokeWidth={px * 2.5}
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {pin.id}
                    </text>
                  )}
                </g>
              ))}

            {/* the thing being drawn */}
            {tool !== "select" && draftPoints.length > 0 && (
              <g pointerEvents="none">
                {tool === "road" || tool === "path" ? (
                  <polyline
                    points={draftPoints.map((q) => q.join(",")).join(" ")}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth={stroke * 2}
                    strokeDasharray={`${px * 6} ${px * 4}`}
                  />
                ) : (
                  <polygon
                    points={draftPoints.map((q) => q.join(",")).join(" ")}
                    fill="#06b6d4"
                    fillOpacity={0.2}
                    stroke="#06b6d4"
                    strokeWidth={stroke * 2}
                    strokeDasharray={`${px * 6} ${px * 4}`}
                  />
                )}
                {draft.map((q, k) => (
                  <circle
                    key={k}
                    cx={q[0]}
                    cy={q[1]}
                    r={handleR * (k === 0 ? 1.1 : 0.8)}
                    fill={k === 0 ? "#f43f5e" : "#06b6d4"}
                    stroke="#fff"
                    strokeWidth={stroke}
                  />
                ))}
              </g>
            )}

            {/* handles of the selection */}
            {tool === "select" &&
              sel?.layer === "buildings" &&
              sel.part?.k === "r" &&
              selectedRect &&
              rectHandles(sel.i, sel.part.j, selectedRect)}
            {tool === "select" &&
              sel &&
              !(sel.layer === "buildings" && sel.part?.k !== "p") &&
              pointHandles(sel)}

            {/* a junction about to be made */}
            {snapView && (
              <circle
                cx={snapView.pt[0]}
                cy={snapView.pt[1]}
                r={handleR * 1.5}
                fill="none"
                stroke="#22c55e"
                strokeWidth={stroke * 2.5}
                pointerEvents="none"
              />
            )}
            {/* while drawing, everything underneath is out of the way */}
            {tool !== "select" && (
              <rect
                x={-2000}
                y={-2000}
                width={6000}
                height={6000}
                fill="transparent"
                onPointerDown={onBackgroundDown}
              />
            )}
          </svg>

          {/* what to do next, right on the drawing */}
          <div className="pointer-events-none absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
            <p className="pointer-events-auto rounded-xl bg-black/70 px-3 py-1.5 text-white text-xs">
              {tool !== "select"
                ? (activeTool?.hint ?? "")
                : sel
                  ? sel.layer === "buildings"
                    ? "Drag to move (Shift moves the whole building). Edges and corners resize, the orange dot rotates. Click a pin dot to link it"
                    : "Drag a blue dot to move it, a white dot to add a point. Drop an end on another road to connect"
                  : "Click a shape to edit it. Drag empty space to move around, scroll to zoom"}
            </p>
            {tool !== "select" && (
              <span className="pointer-events-auto flex gap-1.5">
                <IconBtn
                  icon={Tick02Icon}
                  label="Finish"
                  showLabel
                  tone="primary"
                  onClick={finishDraw}
                />
                <IconBtn
                  icon={Cancel01Icon}
                  label="Cancel"
                  showLabel
                  onClick={cancelDraw}
                />
              </span>
            )}
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-3 overflow-y-auto text-sm lg:w-72">
        {sel && building && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 font-medium">
              <Icon
                icon={
                  building.p?.length && !building.r.length
                    ? Pentagon01Icon
                    : SquareIcon
                }
                className="size-4"
              />
              Building
            </h2>
            <label className="block space-y-1">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Icon icon={Link01Icon} className="size-4" />
                Linked pin
              </span>
              <select
                value={building.id ?? ""}
                onChange={(e) => linkPin(e.target.value)}
                className="w-full rounded-lg border bg-background px-2 py-1.5"
              >
                <option value="">No pin</option>
                {pins.map((pin) => (
                  <option key={pin.id} value={pin.id}>
                    {pin.title} ({pin.id})
                    {linkedIds.has(pin.id) && pin.id !== building.id
                      ? " · linked"
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-1">
              {partChips().map(({ part, label }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setSel({ layer: "buildings", i: sel.i, part })}
                  className={`rounded-full px-2.5 py-0.5 text-xs ${sel.part?.k === part.k && sel.part.j === part.j ? "bg-foreground text-background" : "bg-foreground/10"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {selectedRect && (
              <div className="grid grid-cols-5 gap-1">
                {(["x", "y", "width", "height", "angle"] as const).map(
                  (label, index) => (
                    <label
                      key={label}
                      className="space-y-0.5 text-center text-[10px] text-muted-foreground"
                    >
                      {label}
                      <input
                        type="number"
                        step="0.5"
                        value={Math.round(selectedRect[index] * 10) / 10}
                        onChange={(e) =>
                          setRectField(index, Number(e.target.value))
                        }
                        className="w-full rounded-md border bg-background px-1 py-1 text-foreground text-sm"
                      />
                    </label>
                  ),
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <IconBtn
                icon={SquareIcon}
                label="Add rectangle"
                showLabel
                onClick={() => addRect(sel.i)}
              />
              {selectedRect && sel.part && (
                <IconBtn
                  icon={Pentagon01Icon}
                  label="Make it a polygon"
                  showLabel
                  onClick={() => {
                    const poly = rectToPolygon(selectedRect)
                    const partJ = (sel.part as Part).j
                    change((d) => {
                      const b = d.buildings[sel.i]
                      b.r.splice(partJ, 1)
                      b.p = [...(b.p ?? []), poly]
                    })
                    setSel({
                      layer: "buildings",
                      i: sel.i,
                      part: { k: "p", j: (building.p ?? []).length },
                    })
                  }}
                />
              )}
              {partChips().length > 1 && sel.part && (
                <IconBtn
                  icon={Cancel01Icon}
                  label="Remove this part"
                  showLabel
                  onClick={() => {
                    const part = sel.part as Part
                    change((d) => {
                      const b = d.buildings[sel.i]
                      if (part.k === "r") b.r.splice(part.j, 1)
                      else b.p?.splice(part.j, 1)
                    })
                    setSel({ layer: "buildings", i: sel.i })
                  }}
                />
              )}
              <IconBtn
                icon={Copy01Icon}
                label="Duplicate"
                showLabel
                onClick={() => {
                  const copy = clone(building)
                  delete copy.id
                  for (const r of copy.r) {
                    r[0] += 12
                    r[1] += 12
                  }
                  for (const pts of copy.p ?? [])
                    for (const q of pts) {
                      q[0] += 12
                      q[1] += 12
                    }
                  change((d) => d.buildings.push(copy))
                  setSel({ layer: "buildings", i: shapes.buildings.length })
                }}
              />
            </div>
          </section>
        )}

        {sel && sel.layer !== "buildings" && shapes[sel.layer][sel.i] && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 font-medium capitalize">
              <Icon
                icon={
                  sel.layer === "roads"
                    ? Road01Icon
                    : sel.layer === "paths"
                      ? FootprintsIcon
                      : Tree01Icon
                }
                className="size-4"
              />
              {sel.layer.slice(0, -1)}
            </h2>
            {sel.layer !== "zones" && (
              <label className="block space-y-1">
                <span className="text-muted-foreground">Width</span>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  value={(shapes[sel.layer][sel.i] as { w: number }).w}
                  onChange={(e) => {
                    const layer = sel.layer as LineLayer
                    change((d) => {
                      d[layer][sel.i].w = Math.max(1, Number(e.target.value))
                    })
                  }}
                  className="w-full rounded-lg border bg-background px-2 py-1.5"
                />
              </label>
            )}
            {(sel.layer === "paths" || sel.layer === "zones") && (
              <label className="block space-y-1">
                <span className="text-muted-foreground">Kind</span>
                <select
                  value={(shapes[sel.layer][sel.i] as { kind: string }).kind}
                  onChange={(e) => {
                    const layer = sel.layer as "paths" | "zones"
                    change((d) => {
                      ;(d[layer][sel.i] as { kind: string }).kind =
                        e.target.value
                    })
                  }}
                  className="w-full rounded-lg border bg-background px-2 py-1.5"
                >
                  {(sel.layer === "paths" ? PATH_KINDS : ZONE_KINDS).map(
                    (kind) => (
                      <option key={kind}>{kind}</option>
                    ),
                  )}
                </select>
              </label>
            )}
          </section>
        )}

        {sel && (
          <div className="flex flex-wrap gap-1.5">
            {sel.v !== undefined &&
              pointsOf(shapes, sel) &&
              (pointsOf(shapes, sel) as Point[]).length > minPointsFor(sel) && (
                <IconBtn
                  icon={Delete02Icon}
                  label="Delete point"
                  showLabel
                  onClick={removeSelected}
                />
              )}
            <IconBtn
              icon={Delete02Icon}
              label={
                sel.layer === "buildings" ? "Delete building" : "Delete shape"
              }
              showLabel
              tone="danger"
              onClick={() => {
                change((d) =>
                  (d[(sel as Sel).layer] as unknown[]).splice(
                    (sel as Sel).i,
                    1,
                  ),
                )
                setSel(null)
              }}
            />
          </div>
        )}

        {!sel && (
          <p className="text-muted-foreground">
            Orange buildings are linked to a pin, yellow ones aren't. Pins
            without a building are red dots. Some buildings are rectangles,
            others are free polygons: use <b>Polygon building</b> to draw one
            corner by corner.
          </p>
        )}

        <section className="space-y-1">
          <h2 className="flex items-center gap-1.5 font-medium">
            <Icon icon={SquareIcon} className="size-4" />
            Buildings without a pin (
            {shapes.buildings.filter((b) => !b.id).length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {shapes.buildings.map((b, i) =>
              b.id ? null : (
                <button
                  key={i}
                  type="button"
                  title="Jump there"
                  onClick={() => {
                    const [cx, cy] = buildingCenter(b)
                    setView({ x: cx - 80, y: cy - 80, s: 160 })
                    setSel({
                      layer: "buildings",
                      i,
                      part: b.r.length ? { k: "r", j: 0 } : { k: "p", j: 0 },
                    })
                  }}
                  className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs"
                >
                  #{i + 1}
                </button>
              ),
            )}
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="flex items-center gap-1.5 font-medium">
            <Icon icon={Add01Icon} className="size-4" />
            Pins without a building ({unlinkedPins.length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {unlinkedPins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                title={`${pin.title}: jump there`}
                onClick={() =>
                  setView({ x: pin.x - 100, y: pin.y - 100, s: 200 })
                }
                className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs"
              >
                {pin.id}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}
