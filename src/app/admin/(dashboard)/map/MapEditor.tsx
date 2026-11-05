// biome-ignore-all lint/suspicious/noArrayIndexKey: buildings and points have no ids, their position is their identity
"use client"

import {
  Add01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkBadge01Icon,
  Copy01Icon,
  Cursor02Icon,
  Delete02Icon,
  Edit02Icon,
  FloppyDiskIcon,
  Image01Icon,
  Link01Icon,
  MagnetIcon,
  MapPinIcon,
  Maximize01Icon,
  Pentagon01Icon,
  Redo02Icon,
  SquareIcon,
  Tick02Icon,
  Undo02Icon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import {
  type Building,
  type CampusShapes,
  type Point,
  type Rect,
  rectToPolygon,
} from "@/map/campusShapes"
import { saveCampusShapes } from "./actions"

type Pin = { id: string; title: string; x: number; y: number }
type Sel = { i: number; v?: number }
type Tool = "select" | "poly"
type View = { x: number; y: number; s: number }
type Drag =
  | { kind: "pan"; start: [number, number]; view: View; moved: boolean }
  | { kind: "move"; start: Point; orig: CampusShapes; i: number }
  | { kind: "vertex"; i: number; v: number }
  | { kind: "rect"; i: number; sx: -1 | 0 | 1; sy: -1 | 0 | 1; orig: Rect }
  | { kind: "rotate"; i: number }

const SIZE = 1312
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

function axes(a: number) {
  const rad = (a * Math.PI) / 180
  return {
    ux: [Math.cos(rad), Math.sin(rad)],
    uy: [-Math.sin(rad), Math.cos(rad)],
  }
}
// a point given in a rectangle's own frame (x along its width, y along its height), in the drawing
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

// the smallest rotated rectangle around some points (for "back to a rectangle")
function fitRect(points: Point[]): Rect {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
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
  const hull = [...half(pts), ...half([...pts].reverse())]
  let best: Rect | null = null
  let bestArea = Number.POSITIVE_INFINITY
  hull.forEach((q, k) => {
    const next = hull[(k + 1) % hull.length]
    const angle = (Math.atan2(next[1] - q[1], next[0] - q[0]) * 180) / Math.PI
    const { ux, uy } = axes(angle)
    const us = hull.map((h) => h[0] * ux[0] + h[1] * ux[1])
    const vs = hull.map((h) => h[0] * uy[0] + h[1] * uy[1])
    const w = Math.max(...us) - Math.min(...us)
    const h = Math.max(...vs) - Math.min(...vs)
    if (w * h < bestArea) {
      bestArea = w * h
      const mu = (Math.max(...us) + Math.min(...us)) / 2
      const mv = (Math.max(...vs) + Math.min(...vs)) / 2
      best = [
        mu * ux[0] + mv * uy[0],
        mu * ux[1] + mv * uy[1],
        w,
        h,
        (angle + 360) % 180,
      ]
    }
  })
  return best ?? [0, 0, 10, 10, 0]
}

// a square view around everything drawn, so the buildings start out big instead of tiny
function fitView(shapes: CampusShapes): View {
  const pts = shapes.buildings.flatMap((b) =>
    b.r ? rectToPolygon(b.r) : (b.p ?? []),
  )
  if (!pts.length) return { x: 0, y: 0, s: SIZE }
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  const pad = 40
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2
  const s = Math.min(SIZE * 1.2, Math.max(w, h))
  return {
    s,
    x: (Math.min(...xs) + Math.max(...xs)) / 2 - s / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2 - s / 2,
  }
}

// whether a point lies inside a polygon
function insidePolygon(pt: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi
    )
      inside = !inside
  }
  return inside
}

const outlineOf = (b: Building): Point[] =>
  b.r ? rectToPolygon(b.r) : (b.p ?? [])
// the middle of a building, where its name goes
function centerOf(b: Building): Point {
  const pts = outlineOf(b)
  const xs = pts.map((q) => q[0])
  const ys = pts.map((q) => q[1])
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
}

// ---- snapping: making things parallel ----
const ANGLE_TOL = 4 // degrees
const deg = (r: number) => (r * 180) / Math.PI
const mod180 = (a: number) => ((a % 180) + 180) % 180
const angleOf = (a: Point, b: Point) =>
  mod180(deg(Math.atan2(b[1] - a[1], b[0] - a[0])))
// the smallest turn (in degrees) that makes angle a parallel to angle b
const turnBetween = (a: number, b: number) => {
  const d = mod180(a - b)
  return d > 90 ? d - 180 : d
}
const sidesOf = (b: Building): [Point, Point][] => {
  const pts = outlineOf(b)
  return pts.map((q, k) => [q, pts[(k + 1) % pts.length]] as [Point, Point])
}
// the sides of the other buildings close to a point: what the thing being edited should line up with
function nearbySides(
  all: Building[],
  at: Point,
  reach: number,
  skip: number,
): [Point, Point][] {
  const out: [Point, Point][] = []
  all.forEach((b, i) => {
    if (i === skip) return
    if (outlineOf(b).some((q) => dist(q, at) < reach)) out.push(...sidesOf(b))
  })
  return out
}
const anglesOf = (sides: [Point, Point][]) => [
  0,
  90,
  ...sides.map(([a, b]) => angleOf(a, b)),
]

// move `to` so the line from `from` runs parallel to the closest of `refs`, when one is close enough
function snapParallel(
  from: Point,
  to: Point,
  refs: number[],
): { pt: Point; ref: number } | null {
  if (dist(from, to) < 1) return null
  const here = angleOf(from, to)
  let best: number | null = null
  let bestTurn = ANGLE_TOL
  for (const r of refs) {
    const t = Math.abs(turnBetween(here, r))
    if (t < bestTurn) {
      bestTurn = t
      best = r
    }
  }
  if (best === null) return null
  const rad = (best * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const along = (to[0] - from[0]) * dx + (to[1] - from[1]) * dy
  return { pt: [from[0] + dx * along, from[1] + dy * along], ref: best }
}

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
  const [view, setView] = useState<View>(() => fitView(initial))
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [future, setFuture] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.8)
  const [showPins, setShowPins] = useState(true)
  // only the drafts are left on the drawing, the confirmed ones are put away
  const [hideDone, setHideDone] = useState(false)
  // snapping sides parallel to their neighbours (Alt held skips it for one drag)
  const [snapOn, setSnapOn] = useState(true)
  const [guides, setGuides] = useState<[Point, Point][]>([])
  // names inside buildings: only where they fit (auto), everywhere, or not at all
  const [names, setNames] = useState<"auto" | "all" | "off">("auto")
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  // what the last press landed on: the pointer is captured on press, so a double click no longer
  // reaches the shape, the drawing itself has to decide what it meant
  const lastDown = useRef<"vertex" | "building" | "other">("other")

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
      const factor = event.deltaY > 0 ? 1.15 : 1 / 1.15
      setView((v) => {
        const s = Math.min(SIZE * 1.2, Math.max(60, v.s * factor))
        const k = s / v.s
        return { s, x: at[0] - (at[0] - v.x) * k, y: at[1] - (at[1] - v.y) * k }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  })

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (/INPUT|SELECT|TEXTAREA/.test((event.target as HTMLElement).tagName))
        return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault()
        redo()
      } else if (event.key === "Escape") {
        if (tool !== "select") cancelDraw()
        else setSel(null)
      } else if (
        event.key.toLowerCase() === "c" &&
        tool === "select" &&
        sel &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        toggleDone(sel.i)
      } else if (event.key === "Enter" && tool !== "select") finishDraw()
      else if (event.key === "Delete" || event.key === "Backspace") {
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

  function remember() {
    setHistory((h) => [...h.slice(-59), clone(shapes)])
    setFuture([])
  }
  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setFuture((f) => [...f, clone(shapes)])
    setHistory((h) => h.slice(0, -1))
    setShapes(last)
    setSel(null)
  }
  function redo() {
    const next = future[future.length - 1]
    if (!next) return
    setHistory((h) => [...h, clone(shapes)])
    setFuture((f) => f.slice(0, -1))
    setShapes(next)
    setSel(null)
  }
  function change(fn: (draft: CampusShapes) => void) {
    remember()
    setShapes((current) => {
      const next = clone(current)
      fn(next)
      return next
    })
  }

  // ---- drawing a polygon building ----
  function startPoly() {
    setDraft([])
    setTool("poly")
    setSel(null)
  }
  function cancelDraw() {
    setDraft([])
    setTool("select")
  }
  function finishDraw() {
    // a double click already added the point twice
    const pts = draft.filter(
      (q, k) => k === 0 || dist(q, draft[k - 1]) > px * 2,
    )
    if (pts.length < 3) {
      cancelDraw()
      return
    }
    change((d) => d.buildings.push({ p: pts }))
    setSel({ i: shapes.buildings.length })
    cancelDraw()
  }

  function toggleDone(i: number) {
    change((d) => {
      if (d.buildings[i].done) delete d.buildings[i].done
      else d.buildings[i].done = true
    })
  }

  // the next building still in draft after the selected one (wrapping round), centred on screen
  function nextDraft() {
    const total = shapes.buildings.length
    const from = sel ? sel.i : -1
    for (let step = 1; step <= total; step++) {
      const i = (from + step) % total
      if (!shapes.buildings[i].done) {
        const [cx, cy] = centerOf(shapes.buildings[i])
        setView({ x: cx - 80, y: cy - 80, s: 160 })
        setSel({ i })
        return
      }
    }
  }

  function addRect() {
    const centre: Point = [view.x + view.s / 2, view.y + view.s / 2]
    // a new rectangle starts out parallel to whatever is closest, so it is usually already lined up
    const closest = shapes.buildings
      .map((b) => ({ b, d: dist(centerOf(b), centre) }))
      .sort((a, b) => a.d - b.d)[0]?.b
    const angle = closest
      ? closest.r
        ? closest.r[4]
        : angleOf(...(sidesOf(closest)[0] as [Point, Point]))
      : 0
    change((d) =>
      d.buildings.push({ r: [centre[0], centre[1], 24, 16, angle] }),
    )
    setSel({ i: shapes.buildings.length })
  }

  function removeSelected() {
    if (!sel) return
    const b = shapes.buildings[sel.i]
    if (b?.done) return
    if (sel.v !== undefined && b?.p && b.p.length > 3) {
      change((d) => d.buildings[sel.i].p?.splice(sel.v as number, 1))
      setSel({ i: sel.i })
      return
    }
    change((d) => d.buildings.splice(sel.i, 1))
    setSel(null)
  }

  // ---- pointer handling ----
  function onBackgroundDown(event: React.PointerEvent) {
    lastDown.current = "other"
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    drag.current = {
      kind: "pan",
      start: [event.clientX, event.clientY],
      view,
      moved: false,
    }
  }

  function startMove(event: React.PointerEvent, i: number) {
    if (tool !== "select") return
    lastDown.current = "building"
    event.stopPropagation()
    // a confirmed building can be selected but not dragged by accident, reopen it to change it
    if (shapes.buildings[i]?.done) {
      setSel({ i })
      return
    }
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel({ i })
    drag.current = { kind: "move", start: toSvg(event), orig: clone(shapes), i }
  }

  function startHandle(event: React.PointerEvent, d: Drag) {
    lastDown.current = d.kind === "vertex" ? "vertex" : "other"
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    drag.current = d
  }

  // the points of the shape being drawn, with the side being added snapped parallel to its surroundings
  function snapDraw(raw: Point, free: boolean): Point {
    if (free || draft.length === 0) {
      setGuides([])
      return raw
    }
    const last = draft[draft.length - 1]
    const sides = nearbySides(shapes.buildings, raw, px * 250, -1)
    const own = draft.slice(1).map((q, k) => angleOf(draft[k], q))
    const hit = snapParallel(last, raw, [...anglesOf(sides), ...own])
    setGuides(hit ? [[last, hit.pt]] : [])
    return hit ? hit.pt : raw
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current
    const raw = toSvg(event)
    const free = event.altKey || !snapOn
    if (tool !== "select") setCursor(snapDraw(raw, free))
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
    } else if (d.kind === "move") {
      const dx = raw[0] - d.start[0]
      const dy = raw[1] - d.start[1]
      const next = clone(d.orig)
      const b = next.buildings[d.i]
      if (b.r) {
        b.r[0] += dx
        b.r[1] += dy
      } else {
        for (const q of b.p ?? []) {
          q[0] += dx
          q[1] += dy
        }
      }
      setShapes(next)
    } else if (d.kind === "vertex") {
      // the two sides at this corner snap parallel to nearby sides, or to this shape's own other sides
      let at = raw
      let lines: [Point, Point][] = []
      const pts = shapes.buildings[d.i].p
      if (pts && !free) {
        const prev = pts[(d.v - 1 + pts.length) % pts.length]
        const next = pts[(d.v + 1) % pts.length]
        const others = nearbySides(shapes.buildings, raw, px * 250, d.i)
        const own = pts
          .map((q, k) => [k, q, pts[(k + 1) % pts.length]] as const)
          .filter(([k]) => k !== d.v && (k + 1) % pts.length !== d.v)
          .map(([, a, b]) => angleOf(a, b))
        const refs = [...anglesOf(others), ...own]
        const s1 = snapParallel(prev, raw, refs)
        const s2 = snapParallel(next, raw, refs)
        if (s1 && s2) {
          // both sides want to be parallel to something: the corner goes where those two lines cross
          const r1 = (s1.ref * Math.PI) / 180
          const r2 = (s2.ref * Math.PI) / 180
          const det = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2)
          if (Math.abs(det) > 0.15) {
            const t =
              ((next[0] - prev[0]) * Math.sin(r2) -
                (next[1] - prev[1]) * Math.cos(r2)) /
              det
            at = [prev[0] + Math.cos(r1) * t, prev[1] + Math.sin(r1) * t]
            lines = [
              [prev, at],
              [next, at],
            ]
          } else {
            at = s1.pt
            lines = [[prev, at]]
          }
        } else if (s1) {
          at = s1.pt
          lines = [[prev, at]]
        } else if (s2) {
          at = s2.pt
          lines = [[next, at]]
        }
      }
      setGuides(lines)
      setShapes((current) => {
        const next = clone(current)
        const target = next.buildings[d.i].p
        if (target) target[d.v] = [at[0], at[1]]
        return next
      })
    } else if (d.kind === "rect") {
      // a side pulled close to a parallel side of a neighbour lands flush against it
      let at = raw
      const lines: [Point, Point][] = []
      if (!free) {
        const { ux, uy } = axes(d.orig[4])
        const near = nearbySides(
          shapes.buildings,
          [d.orig[0], d.orig[1]],
          px * 250 + Math.max(d.orig[2], d.orig[3]),
          d.i,
        )
        const tol = px * 8
        const flush = (axis: number[], along: number[], moving: boolean) => {
          if (!moving) return
          let best: { shift: number; side: [Point, Point] } | null = null
          for (const side of near) {
            // only sides running along `along` (so they face the same way as the one being dragged)
            if (
              Math.abs(
                turnBetween(
                  angleOf(side[0], side[1]),
                  mod180(deg(Math.atan2(along[1], along[0]))),
                ),
              ) > 2.5
            )
              continue
            const shift =
              side[0][0] * axis[0] +
              side[0][1] * axis[1] -
              (at[0] * axis[0] + at[1] * axis[1])
            if (
              Math.abs(shift) < tol &&
              (!best || Math.abs(shift) < Math.abs(best.shift))
            )
              best = { shift, side }
          }
          if (best) {
            at = [at[0] + axis[0] * best.shift, at[1] + axis[1] * best.shift]
            lines.push(best.side)
          }
        }
        flush(ux, uy, d.sx !== 0)
        flush(uy, ux, d.sy !== 0)
      }
      setGuides(lines)
      setShapes((current) => {
        const next = clone(current)
        next.buildings[d.i].r = resizeRect(d.orig, at, d.sx, d.sy)
        return next
      })
    } else if (d.kind === "rotate") {
      const rect0 = shapes.buildings[d.i].r
      let angle =
        deg(
          Math.atan2(raw[1] - (rect0?.[1] ?? 0), raw[0] - (rect0?.[0] ?? 0)),
        ) + 90
      let lines: [Point, Point][] = []
      if (rect0 && !free) {
        const near = nearbySides(
          shapes.buildings,
          [rect0[0], rect0[1]],
          px * 250 + Math.max(rect0[2], rect0[3]),
          d.i,
        )
        let bestTurn = ANGLE_TOL
        let target: number | null = null
        for (const r of anglesOf(near)) {
          // a rectangle looks the same every 90 degrees
          const t = ((((angle - r) % 90) + 135) % 90) - 45
          if (Math.abs(t) < bestTurn) {
            bestTurn = Math.abs(t)
            target = angle - t
          }
        }
        if (target !== null) {
          angle = target
          const c: Point = [rect0[0], rect0[1]]
          const long = Math.max(rect0[2], rect0[3]) * 0.9
          const rad = (angle * Math.PI) / 180
          lines = [
            [
              [c[0] - Math.cos(rad) * long, c[1] - Math.sin(rad) * long],
              [c[0] + Math.cos(rad) * long, c[1] + Math.sin(rad) * long],
            ],
          ]
        }
      }
      setGuides(lines)
      setShapes((current) => {
        const next = clone(current)
        const rect = next.buildings[d.i].r
        if (rect) rect[4] = angle
        return next
      })
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    setGuides([])
    if (d?.kind === "pan" && !d.moved) {
      // a plain click on empty space
      if (tool === "select") setSel(null)
      else {
        const raw = toSvg(event)
        // clicking the first corner again closes the shape
        if (draft.length >= 3 && dist(raw, draft[0]) < px * 10) finishDraw()
        else {
          const at = snapDraw(raw, event.altKey || !snapOn)
          setGuides([])
          setDraft((current) => [...current, at])
        }
      }
    }
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
    if (!sel) return
    change((d) => {
      // a pin is one building: take it from any other first
      for (const b of d.buildings) if (b.id === pinId) delete b.id
      if (pinId) d.buildings[sel.i].id = pinId
      else delete d.buildings[sel.i].id
    })
  }

  const building = sel ? (shapes.buildings[sel.i] ?? null) : null
  const linkedIds = new Set(shapes.buildings.map((b) => b.id).filter(Boolean))
  const skipped = new Set(shapes.skipPins ?? [])
  const unlinkedPins = pins.filter(
    (pin) => !linkedIds.has(pin.id) && !skipped.has(pin.id),
  )
  // the unlinked pin closest to the selected building, when it is really close
  const suggestion = (() => {
    if (!building || building.id) return null
    const c = centerOf(building)
    let best: { pin: Pin; d: number } | null = null
    for (const pin of unlinkedPins) {
      const d = dist([pin.x, pin.y], c)
      if (d < 45 && (!best || d < best.d)) best = { pin, d }
    }
    return best?.pin ?? null
  })()
  // pins that sit inside exactly one building, and that building has no pin yet: safe to link at once
  const autoLinks = (() => {
    const out: [number, string][] = []
    const taken = new Set<number>()
    for (const pin of unlinkedPins) {
      const hits = shapes.buildings
        .map((b, i) =>
          !b.id && insidePolygon([pin.x, pin.y], outlineOf(b)) ? i : -1,
        )
        .filter((i) => i >= 0)
      if (hits.length === 1 && !taken.has(hits[0])) {
        taken.add(hits[0])
        out.push([hits[0], pin.id])
      }
    }
    return out
  })()

  function setRectField(index: number, value: number) {
    if (!sel || Number.isNaN(value)) return
    change((d) => {
      const r = d.buildings[sel.i].r
      if (r) r[index] = index === 2 || index === 3 ? Math.max(2, value) : value
    })
  }

  // ---- handles ----
  function rectHandles(i: number, rect: Rect) {
    const [, , w, h, a] = rect
    const edge = (lx: number, ly: number, sx: -1 | 0 | 1, sy: -1 | 0 | 1) => {
      const [x, y] = toWorld(rect, lx, ly)
      const horizontal = sy !== 0 // top and bottom edges are wide, left and right edges are tall
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
            startHandle(e, { kind: "rect", i, sx, sy, orig: clone(rect) })
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
            startHandle(e, { kind: "rect", i, sx, sy, orig: clone(rect) })
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
          onPointerDown={(e) => startHandle(e, { kind: "rotate", i })}
        />
      </g>
    )
  }

  function pointHandles(i: number, pts: Point[]) {
    return (
      <g>
        {pts.map((q, v) => {
          const next = pts[(v + 1) % pts.length]
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
                // a new corner in the middle of that side, picked up straight away
                e.stopPropagation()
                remember()
                setShapes((current) => {
                  const next2 = clone(current)
                  next2.buildings[i].p?.splice(v + 1, 0, mid)
                  return next2
                })
                ;(svgRef.current as SVGSVGElement).setPointerCapture(
                  e.pointerId,
                )
                drag.current = { kind: "vertex", i, v: v + 1 }
                setSel({ i, v: v + 1 })
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
            fill={sel?.v === v ? "#f43f5e" : "#06b6d4"}
            stroke="#fff"
            strokeWidth={stroke}
            style={{ cursor: "grab" }}
            onPointerDown={(e) => {
              setSel({ i, v })
              startHandle(e, { kind: "vertex", i, v })
            }}
          />
        ))}
      </g>
    )
  }

  const draftPoints = cursor && draft.length ? [...draft, cursor] : draft

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col gap-2 p-2 lg:flex-row">
      <div className="flex min-h-0 flex-1 select-none flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn
            icon={Cursor02Icon}
            label="Select"
            showLabel
            active={tool === "select"}
            onClick={cancelDraw}
          />
          <IconBtn
            icon={Pentagon01Icon}
            label="Draw a building"
            showLabel
            active={tool === "poly"}
            onClick={startPoly}
          />
          <IconBtn
            icon={SquareIcon}
            label="Add a rectangle"
            showLabel
            onClick={addRect}
          />
          <span className="mx-1 h-6 w-px bg-border" />
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-3 py-1.5 text-green-600 text-sm dark:text-green-400"
            title="Confirmed buildings"
          >
            <Icon icon={CheckmarkBadge01Icon} className="size-4" />
            {shapes.buildings.filter((b) => b.done).length} /{" "}
            {shapes.buildings.length}
          </span>
          <IconBtn
            icon={ArrowRight01Icon}
            label="Next draft"
            showLabel
            onClick={nextDraft}
          />
          <IconBtn
            icon={ViewOffIcon}
            label="Hide confirmed"
            active={hideDone}
            onClick={() => setHideDone((v) => !v)}
          />
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
        <div className="flex flex-wrap items-center gap-1.5">
          <IconBtn
            icon={Undo02Icon}
            label="Undo (Ctrl+Z)"
            onClick={undo}
            disabled={history.length === 0}
          />
          <IconBtn
            icon={Redo02Icon}
            label="Redo (Ctrl+Shift+Z)"
            onClick={redo}
            disabled={future.length === 0}
          />
          <IconBtn
            icon={MagnetIcon}
            label="Snap sides parallel (hold Alt to skip)"
            active={snapOn}
            onClick={() => setSnapOn((v) => !v)}
          />
          <IconBtn
            icon={MapPinIcon}
            label="Show pins"
            active={showPins}
            onClick={() => setShowPins((v) => !v)}
          />
          <IconBtn
            icon={Edit02Icon}
            label={
              names === "auto"
                ? "Names: where they fit"
                : names === "all"
                  ? "Names: all"
                  : "Names: off"
            }
            showLabel
            active={names !== "off"}
            onClick={() =>
              setNames((n) =>
                n === "auto" ? "all" : n === "all" ? "off" : "auto",
              )
            }
          />
          <IconBtn
            icon={Maximize01Icon}
            label="Fit everything"
            onClick={() => setView(fitView(shapes))}
          />
          <label
            className="flex items-center gap-1.5 px-1 text-sm"
            title="How strong the satellite photo is"
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
        </div>

        <div className="relative min-h-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
            className="size-full touch-none select-none rounded-2xl bg-neutral-900"
            style={{
              cursor: tool === "select" ? "default" : "crosshair",
              userSelect: "none",
              WebkitUserSelect: "none",
            }}
            onMouseDown={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            preserveAspectRatio="xMidYMid meet"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={() => {
              if (tool !== "select") finishDraw()
              else if (lastDown.current === "vertex") removeSelected()
              else if (lastDown.current === "building" && sel) {
                const b = shapes.buildings[sel.i]
                if (b) {
                  const [cx, cy] = centerOf(b)
                  setView({ x: cx - 70, y: cy - 70, s: 140 })
                }
              }
            }}
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

            {shapes.buildings.map((b, i) => {
              if (hideDone && b.done && sel?.i !== i) return null
              const selected = sel?.i === i
              const common = {
                fill: b.id ? "#ff7a45" : "#facc15",
                fillOpacity: 0.55,
                // confirmed: a solid green outline. Draft: a dashed white one
                stroke: selected ? "#06b6d4" : b.done ? "#22c55e" : "#ffffff",
                strokeWidth: selected
                  ? stroke * 2.2
                  : b.done
                    ? stroke * 2
                    : stroke,
                strokeDasharray: b.done ? undefined : `${px * 5} ${px * 3}`,
                onPointerDown: (e: React.PointerEvent) => startMove(e, i),
              }
              return b.r ? (
                <rect
                  key={i}
                  x={-b.r[2] / 2}
                  y={-b.r[3] / 2}
                  width={b.r[2]}
                  height={b.r[3]}
                  transform={`translate(${b.r[0]} ${b.r[1]}) rotate(${b.r[4]})`}
                  {...common}
                />
              ) : (
                <polygon
                  key={i}
                  points={(b.p ?? []).map((q) => q.join(",")).join(" ")}
                  {...common}
                />
              )
            })}

            {/* every building says which pin it is, right inside it */}
            {shapes.buildings.map((b, i) => {
              if (names === "off") return null
              const [cx, cy] = centerOf(b)
              const title = b.id
                ? (pins.find((pin) => pin.id === b.id)?.title ?? b.id)
                : "no pin"
              if (hideDone && b.done && sel?.i !== i) return null
              const shown = `${b.done ? "✓ " : ""}${title.length > 20 ? `${title.slice(0, 19)}…` : title}`
              // in auto, a name only shows once its building is big enough on screen to hold it
              const xs = outlineOf(b).map((q) => q[0])
              if (
                names === "auto" &&
                (Math.max(...xs) - Math.min(...xs)) / px < shown.length * 5.6
              )
                return null
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
                    if (sel && tool === "select") {
                      e.stopPropagation()
                      linkPin(pin.id)
                    }
                  }}
                  // a linked pin sits in the middle of its own building: it must not steal the click that
                  // selects that building. Only pins still waiting for a building can be clicked to link
                  pointerEvents={linkedIds.has(pin.id) ? "none" : "auto"}
                  style={{ cursor: sel ? "pointer" : "default" }}
                >
                  <circle
                    cx={pin.x}
                    cy={pin.y}
                    r={handleR * 0.7}
                    fill={linkedIds.has(pin.id) ? "#22c55e" : "#ef4444"}
                    stroke="#fff"
                    strokeWidth={stroke}
                  />
                  {!linkedIds.has(pin.id) && view.s < 650 && (
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

            {/* the building being drawn */}
            {tool === "poly" && draftPoints.length > 0 && (
              <g pointerEvents="none">
                <polygon
                  points={draftPoints.map((q) => q.join(",")).join(" ")}
                  fill="#06b6d4"
                  fillOpacity={0.2}
                  stroke="#06b6d4"
                  strokeWidth={stroke * 2}
                  strokeDasharray={`${px * 6} ${px * 4}`}
                />
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

            {/* what the thing being dragged is lining up with */}
            {guides.map(([a, b], k) => (
              <line
                key={`g${k}`}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="#e879f9"
                strokeWidth={stroke * 1.6}
                strokeDasharray={`${px * 5} ${px * 4}`}
                pointerEvents="none"
              />
            ))}

            {/* handles of the selected building: a rectangle has edges and corners, plain vertices have points */}
            {tool === "select" &&
              building?.r &&
              !building.done &&
              sel &&
              rectHandles(sel.i, building.r)}
            {tool === "select" &&
              building?.p &&
              !building.done &&
              sel &&
              pointHandles(sel.i, building.p)}
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

          <div className="pointer-events-none absolute right-2 bottom-2 left-2 flex items-end justify-between gap-2">
            <p className="pointer-events-auto rounded-xl bg-black/70 px-3 py-1.5 text-white text-xs">
              {tool === "poly"
                ? "Click each corner of the building. Backspace removes the last corner. Click the first one, double-click or press Enter to finish"
                : building?.done
                  ? "This building is confirmed and locked. Reopen it in the panel to change it"
                  : building?.r
                    ? "Drag a side or corner to resize only that side, the orange dot rotates. Use Edit as vertices when a rectangle isn't enough"
                    : building
                      ? "Drag a blue dot to move a corner, a white dot to add one. Double-click a corner to remove it"
                      : "Click a building to edit it. Drag empty space to move around, scroll to zoom"}
            </p>
            {tool === "poly" && (
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
                icon={building.r ? SquareIcon : Pentagon01Icon}
                className="size-4"
              />
              {building.r
                ? "Rectangle"
                : `Free shape, ${building.p?.length} corners`}
            </h2>
            {building.done ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-green-500/15 px-3 py-2">
                <span className="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400">
                  <Icon icon={CheckmarkBadge01Icon} className="size-4" />
                  Confirmed, locked
                </span>
                <IconBtn
                  icon={Edit02Icon}
                  label="Reopen"
                  showLabel
                  onClick={() => toggleDone(sel.i)}
                />
              </div>
            ) : (
              <IconBtn
                icon={Tick02Icon}
                label="Confirm this building (C)"
                showLabel
                tone="primary"
                onClick={() => toggleDone(sel.i)}
              />
            )}
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

            {suggestion && (
              <IconBtn
                icon={Link01Icon}
                label={`Link ${suggestion.title} (closest pin)`}
                showLabel
                onClick={() => linkPin(suggestion.id)}
              />
            )}
            {building.r && (
              <div className="grid grid-cols-3 gap-1.5">
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
                        value={
                          Math.round((building.r as Rect)[index] * 10) / 10
                        }
                        onChange={(e) =>
                          setRectField(index, Number(e.target.value))
                        }
                        disabled={building.done}
                        className="w-full rounded-md border bg-background px-1 py-1 text-foreground text-sm disabled:opacity-50"
                      />
                    </label>
                  ),
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {building.r ? (
                <IconBtn
                  icon={Pentagon01Icon}
                  label="Edit as vertices"
                  showLabel
                  disabled={building.done}
                  onClick={() => {
                    const rect = building.r as Rect
                    change((d) => {
                      d.buildings[sel.i].p = rectToPolygon(rect)
                      delete d.buildings[sel.i].r
                    })
                  }}
                />
              ) : (
                <IconBtn
                  icon={SquareIcon}
                  label="Back to a rectangle"
                  showLabel
                  disabled={building.done}
                  onClick={() => {
                    const fitted = fitRect(building.p ?? [])
                    change((d) => {
                      d.buildings[sel.i].r = fitted
                      delete d.buildings[sel.i].p
                    })
                  }}
                />
              )}
              <IconBtn
                icon={Maximize01Icon}
                label="Zoom to it"
                showLabel
                onClick={() => {
                  const [cx, cy] = centerOf(building)
                  setView({ x: cx - 60, y: cy - 60, s: 120 })
                }}
              />
              <IconBtn
                icon={Copy01Icon}
                label="Duplicate"
                showLabel
                onClick={() => {
                  const copy = clone(building)
                  delete copy.id
                  // a copy starts as a draft
                  delete copy.done
                  if (copy.r) {
                    copy.r[0] += 12
                    copy.r[1] += 12
                  }
                  for (const q of copy.p ?? []) {
                    q[0] += 12
                    q[1] += 12
                  }
                  change((d) => d.buildings.push(copy))
                  setSel({ i: shapes.buildings.length })
                }}
              />
              {sel.v !== undefined && (building.p?.length ?? 0) > 3 && (
                <IconBtn
                  icon={Cancel01Icon}
                  label="Delete corner"
                  showLabel
                  onClick={removeSelected}
                />
              )}
              <IconBtn
                icon={Delete02Icon}
                label="Delete building"
                showLabel
                tone="danger"
                disabled={building.done}
                onClick={() => {
                  change((d) => d.buildings.splice(sel.i, 1))
                  setSel(null)
                }}
              />
            </div>
          </section>
        )}

        {!sel && (
          <p className="text-muted-foreground">
            Every building is one shape. Orange ones are linked to a pin, yellow
            ones aren't, red dots are pins without a building. Most are
            rectangles, switch one to vertices whenever you need more control.
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
                    const [cx, cy] = centerOf(b)
                    setView({ x: cx - 80, y: cy - 80, s: 160 })
                    setSel({ i })
                  }}
                  className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs"
                >
                  #{i + 1}
                </button>
              ),
            )}
          </div>
        </section>

        <section className="space-y-1.5">
          <h2 className="flex items-center gap-1.5 font-medium">
            <Icon icon={Add01Icon} className="size-4" />
            Pins without a building ({unlinkedPins.length})
          </h2>
          {autoLinks.length > 0 && (
            <IconBtn
              icon={Link01Icon}
              label={`Link ${autoLinks.length} pin${autoLinks.length === 1 ? " that sits" : "s that sit"} inside a building`}
              showLabel
              onClick={() =>
                change((d) => {
                  for (const [i, pinId] of autoLinks) d.buildings[i].id = pinId
                })
              }
            />
          )}
          <div className="flex flex-wrap gap-1">
            {unlinkedPins.map((pin) => (
              <span
                key={pin.id}
                className="inline-flex items-center rounded-full bg-red-500/15 text-xs"
              >
                <button
                  type="button"
                  title={`${pin.title}: jump there`}
                  onClick={() =>
                    setView({ x: pin.x - 100, y: pin.y - 100, s: 200 })
                  }
                  className="rounded-full py-0.5 pr-1 pl-2"
                >
                  {pin.id}
                </button>
                <button
                  type="button"
                  title="This one needs no building (a field, a parking lot...)"
                  aria-label={`${pin.title} needs no building`}
                  onClick={() =>
                    change((d) => {
                      d.skipPins = [...(d.skipPins ?? []), pin.id]
                    })
                  }
                  className="rounded-full py-0.5 pr-1.5 pl-0.5 opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {skipped.size > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Needing no building ({skipped.size})
              </summary>
              <div className="mt-1 flex flex-wrap gap-1">
                {[...skipped].map((id) => (
                  <button
                    key={id}
                    type="button"
                    title="Put it back in the list"
                    onClick={() =>
                      change((d) => {
                        d.skipPins = (d.skipPins ?? []).filter((x) => x !== id)
                      })
                    }
                    className="rounded-full bg-foreground/10 px-2 py-0.5"
                  >
                    {id}
                  </button>
                ))}
              </div>
            </details>
          )}
        </section>
      </aside>
    </div>
  )
}
