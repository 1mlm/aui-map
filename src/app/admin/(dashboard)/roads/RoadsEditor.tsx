// biome-ignore-all lint/suspicious/noArrayIndexKey: lines have no ids, their position is their identity
"use client"

import {
  Cancel01Icon,
  CircleIcon,
  Cursor02Icon,
  Delete02Icon,
  FloppyDiskIcon,
  Pentagon01Icon,
  Redo02Icon,
  Road01Icon,
  Route01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import {
  type CampusShapes,
  type Point,
  rectToPolygon,
  ROAD_WALK_BAND,
  smoothPath,
} from "@/map/campusShapes"
import { saveCampusLines } from "../map/actions"

const SIZE = 1312
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

type Layer = "roads" | "paths" | "zones" | "roundabouts"
type Tool = "select" | "area" | "road" | "ring" | "path"
type AreaKind = "walk" | "field" | "court" | "parking"
type PathKind = "walk" | "dirt" | "green"
type Sel = { layer: Layer; i: number; v?: number }
type View = { x: number; y: number; s: number }
type Drag =
  | { kind: "pan"; start: [number, number]; view: View; moved: boolean }
  | { kind: "vertex"; sel: Sel & { v: number } }
  | { kind: "move"; start: Point; orig: CampusShapes; sel: Sel }
  | { kind: "radius"; i: number }

const AREA_KINDS: { id: AreaKind; label: string; color: string }[] = [
  { id: "walk", label: "Walkway", color: "#f6eed9" },
  { id: "field", label: "Field", color: "#a9d18f" },
  { id: "court", label: "Court", color: "#d98a68" },
  { id: "parking", label: "Parking", color: "#c9ccd0" },
]
const PATH_KINDS: { id: PathKind; label: string; color: string; w: number }[] =
  [
    { id: "walk", label: "Paved", color: "#f6eed9", w: 3.5 },
    { id: "dirt", label: "Dirt", color: "#d8bf92", w: 3 },
    { id: "green", label: "Green", color: "#a6cf8d", w: 4 },
  ]
const PATH_COLOR = { walk: "#f6eed9", dirt: "#d8bf92", green: "#a6cf8d" }
const ZONE_FILL = {
  walk: "#f6eed9",
  field: "#a9d18f",
  court: "#d98a68",
  parking: "#c9ccd0",
}
const TOOLS: { id: Tool; label: string; icon: HugeIcon; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    icon: Cursor02Icon,
    hint: "Click anything to edit it",
  },
  {
    id: "area",
    label: "Area",
    icon: Pentagon01Icon,
    hint: "Click the corners. Enter to finish",
  },
  {
    id: "road",
    label: "Road",
    icon: Road01Icon,
    hint: "Click along the road. Enter to finish",
  },
  {
    id: "ring",
    label: "Roundabout",
    icon: CircleIcon,
    hint: "Click the middle, then click the edge",
  },
  {
    id: "path",
    label: "Path",
    icon: Route01Icon,
    hint: "Click along the path. Enter to finish",
  },
]

function nearestOnCircle(p: Point, c: Point, r: number): Point {
  const d = dist(p, c) || 1
  return [c[0] + ((p[0] - c[0]) / d) * r, c[1] + ((p[1] - c[1]) / d) * r]
}

const Chip = ({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  color?: string
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-1.5 rounded-lg corner-squircle px-2.5 py-1 text-sm transition-colors ${
      active
        ? "bg-primary font-semibold text-primary-foreground"
        : "hover:bg-foreground/10"
    }`}
  >
    {color && (
      <span
        className="size-3 rounded-[0.25rem] ring-1 ring-black/20"
        style={{ background: color }}
      />
    )}
    {children}
  </button>
)

const IconAction = ({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: HugeIcon
  label: string
  onClick: () => void
  disabled?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className="grid size-9 place-items-center rounded-xl corner-squircle bg-background/90 shadow-sm ring-1 ring-foreground/10 backdrop-blur transition-colors hover:bg-background disabled:opacity-35"
  >
    <Icon icon={icon} className="size-[1.15rem]" />
  </button>
)

export function RoadsEditor({ initial }: { initial: CampusShapes }) {
  const [shapes, setShapes] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(lines(initial)))
  const [tool, setTool] = useState<Tool>("select")
  const [areaKind, setAreaKind] = useState<AreaKind>("walk")
  const [pathKind, setPathKind] = useState<PathKind>("walk")
  const [draft, setDraft] = useState<Point[]>([])
  const [ringCenter, setRingCenter] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [view, setView] = useState<View>({ x: 180, y: 120, s: 940 })
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [future, setFuture] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.85)
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)

  const dirty = JSON.stringify(lines(shapes)) !== saved
  const px = view.s / pxWidth
  const handleR = px * 6
  const drawing = tool !== "select"

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPxWidth(el.clientWidth || 800))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
      } else if (event.key === "Escape") {
        if (drawing) cancelDraw()
        else setSel(null)
      } else if (event.key === "Enter" && drawing) finishDraw()
      else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        if (drawing) setDraft((d) => d.slice(0, -1))
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

  // a new point sticks to a nearby corner, road point, or the edge of a roundabout, so everything
  // that meets really meets. Alt skips it
  function snapPoint(raw: Point, free: boolean): Point {
    if (free) return raw
    let best: Point | null = null
    let bestD = px * 9
    const all = [
      ...shapes.roads.flatMap((r) => r.p),
      ...shapes.paths.flatMap((r) => r.p),
      ...shapes.zones.flatMap((z) => z.p),
      ...shapes.buildings.flatMap((b) =>
        b.r ? rectToPolygon(b.r) : (b.p ?? []),
      ),
      ...draft,
    ]
    for (const q of all) {
      const d = dist(q, raw)
      if (d < bestD) {
        best = q
        bestD = d
      }
    }
    for (const ring of shapes.roundabouts) {
      const q = nearestOnCircle(raw, ring.c, ring.r)
      const d = dist(q, raw)
      if (d < bestD) {
        best = q
        bestD = d
      }
    }
    return best ? ([...best] as Point) : raw
  }

  function pickTool(next: Tool) {
    setDraft([])
    setRingCenter(null)
    setSel(null)
    setTool(next)
  }
  function cancelDraw() {
    setDraft([])
    setRingCenter(null)
    setTool("select")
  }
  function finishDraw() {
    const pts = draft.filter(
      (q, k) => k === 0 || dist(q, draft[k - 1]) > px * 2,
    )
    const need = tool === "area" ? 3 : 2
    if (pts.length < need) {
      setDraft([])
      return
    }
    if (tool === "road") change((d) => d.roads.push({ w: 7, p: pts }))
    else if (tool === "path")
      change((d) =>
        d.paths.push({
          w: PATH_KINDS.find((k) => k.id === pathKind)?.w ?? 3.5,
          kind: pathKind,
          p: pts,
        }),
      )
    else if (tool === "area")
      change((d) => d.zones.push({ kind: areaKind, p: pts }))
    setDraft([])
  }

  function removeSelected() {
    if (!sel) return
    if (sel.layer === "roundabouts") {
      change((d) => d.roundabouts.splice(sel.i, 1))
      setSel(null)
      return
    }
    const entry = shapes[sel.layer][sel.i] as { p: Point[] } | undefined
    if (!entry) return
    const min = sel.layer === "zones" ? 3 : 2
    if (sel.v !== undefined && entry.p.length > min) {
      change((d) =>
        (d[sel.layer][sel.i] as { p: Point[] }).p.splice(sel.v as number, 1),
      )
      setSel({ layer: sel.layer, i: sel.i })
      return
    }
    change((d) => d[sel.layer].splice(sel.i, 1))
    setSel(null)
  }

  function setField(field: "w" | "r", value: number) {
    if (!sel || sel.layer === "zones") return
    const { layer, i } = sel
    change((d) => {
      ;(d[layer][i] as unknown as Record<string, number>)[field] = value
    })
  }
  function setKind(kind: string) {
    if (!sel) return
    const { layer, i } = sel
    if (layer !== "paths" && layer !== "zones") return
    change((d) => {
      ;(d[layer][i] as { kind: string }).kind = kind
    })
  }

  function startMove(event: React.PointerEvent, layer: Layer, i: number) {
    if (tool !== "select") return
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel({ layer, i })
    drag.current = {
      kind: "move",
      start: toSvg(event),
      orig: clone(shapes),
      sel: { layer, i },
    }
  }
  function startVertex(
    event: React.PointerEvent,
    layer: Layer,
    i: number,
    v: number,
  ) {
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel({ layer, i, v })
    drag.current = { kind: "vertex", sel: { layer, i, v } }
  }
  function startRadius(event: React.PointerEvent, i: number) {
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    drag.current = { kind: "radius", i }
  }
  function onBackgroundDown(event: React.PointerEvent) {
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    drag.current = {
      kind: "pan",
      start: [event.clientX, event.clientY],
      view,
      moved: false,
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const raw = toSvg(event)
    if (drawing)
      setCursor(
        tool === "ring" && ringCenter ? raw : snapPoint(raw, event.altKey),
      )
    const d = drag.current
    if (!d) return
    if (d.kind === "pan") {
      const dx = event.clientX - d.start[0]
      const dy = event.clientY - d.start[1]
      if (!d.moved && Math.hypot(dx, dy) < 4) return
      d.moved = true
      const scale = d.view.s / pxWidth
      setView({ ...d.view, x: d.view.x - dx * scale, y: d.view.y - dy * scale })
    } else if (d.kind === "move") {
      const dx = raw[0] - d.start[0]
      const dy = raw[1] - d.start[1]
      setShapes(() => {
        const next = clone(d.orig)
        if (d.sel.layer === "roundabouts") {
          const ring = next.roundabouts[d.sel.i]
          ring.c = [ring.c[0] + dx, ring.c[1] + dy]
        } else {
          const entry = next[d.sel.layer][d.sel.i] as { p: Point[] }
          entry.p = entry.p.map(([x, y]) => [x + dx, y + dy] as Point)
        }
        return next
      })
    } else if (d.kind === "vertex") {
      const at = snapPoint(raw, event.altKey)
      const { layer, i, v } = d.sel
      setShapes((current) => {
        const next = clone(current)
        ;(next[layer as "roads"][i] as { p: Point[] }).p[v] = at
        return next
      })
    } else if (d.kind === "radius") {
      setShapes((current) => {
        const next = clone(current)
        const ring = next.roundabouts[d.i]
        ring.r = Math.max(4, dist(raw, ring.c))
        return next
      })
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    if (d?.kind === "pan" && !d.moved) {
      if (tool === "select") setSel(null)
      else if (tool === "ring") {
        const at = toSvg(event)
        if (!ringCenter) setRingCenter(at)
        else {
          change((s) =>
            s.roundabouts.push({
              c: ringCenter,
              r: Math.max(5, dist(at, ringCenter)),
              w: 6,
            }),
          )
          setRingCenter(null)
          setSel({ layer: "roundabouts", i: shapes.roundabouts.length })
          setTool("select")
        }
      } else {
        const at = snapPoint(toSvg(event), event.altKey)
        if (draft.length >= 2 && dist(at, draft[draft.length - 1]) < px * 4)
          finishDraw()
        else if (
          tool === "area" &&
          draft.length >= 3 &&
          dist(at, draft[0]) < px * 10
        )
          finishDraw()
        else setDraft((current) => [...current, at])
      }
    }
  }

  function addMidpoint(layer: Layer, i: number, after: number) {
    const entry = shapes[layer as "roads"][i] as { p: Point[] }
    const a = entry.p[after]
    const b = entry.p[(after + 1) % entry.p.length]
    change((d) => {
      ;(d[layer as "roads"][i] as { p: Point[] }).p.splice(after + 1, 0, [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      ])
    })
    setSel({ layer, i, v: after + 1 })
  }

  async function save() {
    setSaving(true)
    setStatus("")
    const result = await saveCampusLines(lines(shapes))
    setSaving(false)
    if ("error" in result) setStatus(result.error)
    else {
      setSaved(JSON.stringify(lines(shapes)))
      setStatus("Saved")
    }
  }

  const selected = sel
    ? (shapes[sel.layer][sel.i] as unknown as
        | { p?: Point[]; w?: number; r?: number; kind?: string }
        | undefined)
    : undefined
  const draftPoints =
    cursor && drawing && tool !== "ring" ? [...draft, cursor] : draft

  const hint = drawing
    ? (TOOLS.find((t) => t.id === tool)?.hint ?? "")
    : sel
      ? "Drag it to move. Drag a square to move a point, a small circle adds one. Delete removes"
      : "Click anything to edit it. Drag empty space to move around, scroll to zoom"

  // what the bar at the top offers right now: only what applies to what is being drawn or selected
  const barFor: Tool | Layer | null = drawing
    ? tool
    : sel
      ? sel.layer === "zones"
        ? "area"
        : sel.layer === "roads"
          ? "road"
          : sel.layer === "paths"
            ? "path"
            : "ring"
      : null
  const activeAreaKind = (
    sel?.layer === "zones" ? selected?.kind : areaKind
  ) as AreaKind
  const activePathKind = (
    sel?.layer === "paths" ? selected?.kind : pathKind
  ) as PathKind

  function renderEditable(layer: Layer, i: number) {
    const sel1 = sel?.layer === layer && sel.i === i
    if (layer === "roundabouts") {
      const ring = shapes.roundabouts[i]
      return (
        <g key={`ring-${i}`}>
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#f6eed9"
            strokeWidth={ring.w + ROAD_WALK_BAND * 2}
            opacity={0.9}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#b8b3a4"
            strokeWidth={ring.w + 2.4}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="none"
            stroke="#fffdf6"
            strokeWidth={ring.w}
            pointerEvents="none"
          />
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={Math.max(0, ring.r - ring.w / 2 - 0.6)}
            fill="#b9d9a3"
            pointerEvents="none"
          />
          {sel1 && (
            <circle
              cx={ring.c[0]}
              cy={ring.c[1]}
              r={ring.r}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={px * 1.5}
              strokeDasharray={`${px * 4} ${px * 3}`}
              pointerEvents="none"
            />
          )}
          <circle
            cx={ring.c[0]}
            cy={ring.c[1]}
            r={ring.r}
            fill="transparent"
            stroke="transparent"
            strokeWidth={Math.max(px * 14, ring.w + 6)}
            onPointerDown={(e) => startMove(e, "roundabouts", i)}
            pointerEvents={tool === "select" ? undefined : "none"}
            style={{ cursor: "move" }}
          />
          {sel1 && tool === "select" && (
            <rect
              x={ring.c[0] + ring.r - handleR}
              y={ring.c[1] - handleR}
              width={handleR * 2}
              height={handleR * 2}
              rx={handleR * 0.5}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={px * 1.5}
              style={{ cursor: "ew-resize" }}
              onPointerDown={(e) => startRadius(e, i)}
            />
          )}
        </g>
      )
    }
    const entry = shapes[layer][i] as { p: Point[]; w?: number; kind?: string }
    const closed = layer === "zones"
    const d = closed
      ? `M${entry.p.map((q) => q.join(" ")).join("L")}Z`
      : smoothPath(entry.p)
    return (
      <g key={`${layer}-${i}`}>
        {layer === "zones" ? (
          <path
            d={d}
            fill={ZONE_FILL[(entry.kind as AreaKind) ?? "walk"]}
            fillOpacity={0.65}
            stroke={sel1 ? "#fff" : "rgba(0,0,0,0.35)"}
            strokeWidth={px * (sel1 ? 2 : 1)}
            pointerEvents="none"
          />
        ) : layer === "roads" ? (
          <>
            <path
              d={d}
              fill="none"
              stroke="#f6eed9"
              strokeWidth={(entry.w ?? 7) + ROAD_WALK_BAND * 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.9}
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke="#b8b3a4"
              strokeWidth={(entry.w ?? 7) + 2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke="#fffdf6"
              strokeWidth={entry.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
          </>
        ) : (
          <path
            d={d}
            fill="none"
            stroke={PATH_COLOR[(entry.kind as PathKind) ?? "walk"]}
            strokeWidth={entry.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}
        {sel1 && !closed && (
          <path
            d={d}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={px * 1.5}
            strokeDasharray={`${px * 4} ${px * 3}`}
            pointerEvents="none"
          />
        )}
        <path
          d={d}
          fill={closed ? "transparent" : "none"}
          stroke="transparent"
          strokeWidth={Math.max(px * 14, (entry.w ?? 0) + 4)}
          strokeLinecap="round"
          onPointerDown={(e) => startMove(e, layer, i)}
          pointerEvents={tool === "select" ? undefined : "none"}
          style={{ cursor: "move" }}
        />
        {sel1 &&
          tool === "select" &&
          entry.p.map((q, v) => {
            const next = entry.p[(v + 1) % entry.p.length]
            const last = v === entry.p.length - 1
            return (
              <g key={`h-${v}`}>
                {(!last || closed) && (
                  <circle
                    cx={(q[0] + next[0]) / 2}
                    cy={(q[1] + next[1]) / 2}
                    r={handleR * 0.6}
                    fill="#fff"
                    fillOpacity={0.6}
                    stroke="#3b82f6"
                    strokeWidth={px}
                    style={{ cursor: "copy" }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      addMidpoint(layer, i, v)
                    }}
                  />
                )}
                <rect
                  x={q[0] - handleR}
                  y={q[1] - handleR}
                  width={handleR * 2}
                  height={handleR * 2}
                  rx={handleR * 0.5}
                  fill={sel?.v === v ? "#3b82f6" : "#fff"}
                  stroke="#3b82f6"
                  strokeWidth={px * 1.5}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => startVertex(e, layer, i, v)}
                />
              </g>
            )
          })}
      </g>
    )
  }

  return (
    <div className="relative h-full min-h-0 p-2">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
        className="size-full touch-none select-none rounded-2xl bg-neutral-900"
        style={{
          cursor: drawing ? "crosshair" : "default",
          userSelect: "none",
        }}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => {
          if (drawing && tool !== "ring") finishDraw()
          else if (sel?.v !== undefined) removeSelected()
        }}
      >
        <title>Paths and areas</title>
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

        {/* the buildings, to line things up with. Edited in the Buildings view */}
        {shapes.buildings.map((b, i) => (
          <path
            key={`b-${i}`}
            d={`M${(b.r ? rectToPolygon(b.r) : (b.p ?? [])).map((q) => q.join(" ")).join("L")}Z`}
            fill="rgba(217,128,95,0.4)"
            stroke="rgba(156,79,56,0.85)"
            strokeWidth={px}
            pointerEvents="none"
          />
        ))}

        {shapes.zones.map((_, i) => renderEditable("zones", i))}
        {shapes.paths.map((_, i) => renderEditable("paths", i))}
        {shapes.roads.map((_, i) => renderEditable("roads", i))}
        {shapes.roundabouts.map((_, i) => renderEditable("roundabouts", i))}

        {drawing && tool !== "ring" && draftPoints.length > 0 && (
          <>
            <path
              d={`M${draftPoints.map((q) => q.join(" ")).join("L")}`}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={px * 2}
              strokeDasharray={`${px * 5} ${px * 3}`}
              pointerEvents="none"
            />
            {draft.map((q, k) => (
              <circle
                key={`d-${k}`}
                cx={q[0]}
                cy={q[1]}
                r={handleR * 0.7}
                fill="#3b82f6"
                pointerEvents="none"
              />
            ))}
          </>
        )}
        {tool === "ring" && ringCenter && cursor && (
          <circle
            cx={ringCenter[0]}
            cy={ringCenter[1]}
            r={dist(cursor, ringCenter)}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={px * 2}
            strokeDasharray={`${px * 5} ${px * 3}`}
            pointerEvents="none"
          />
        )}
        {drawing && cursor && (
          <circle
            cx={cursor[0]}
            cy={cursor[1]}
            r={handleR * 0.5}
            fill="none"
            stroke="#fff"
            strokeWidth={px * 1.5}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* the tools, one column on the left */}
      <div className="absolute top-5 left-5 flex flex-col gap-1 rounded-2xl corner-squircle bg-background/90 p-1.5 shadow-md ring-1 ring-foreground/10 backdrop-blur">
        {TOOLS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => pickTool(id)}
            title={label}
            className={`flex w-16 flex-col items-center gap-0.5 rounded-xl corner-squircle py-2 text-[0.7rem] font-medium transition-colors ${
              tool === id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-foreground/10"
            }`}
          >
            <Icon icon={icon} className="size-5" />
            {label}
          </button>
        ))}
      </div>

      {/* what the current tool or selection offers, and nothing else */}
      {barFor && (
        <div className="absolute top-5 left-28 flex flex-wrap items-center gap-1 rounded-2xl corner-squircle bg-background/90 p-1.5 text-sm shadow-md ring-1 ring-foreground/10 backdrop-blur">
          {barFor === "area" &&
            AREA_KINDS.map((k) => (
              <Chip
                key={k.id}
                color={k.color}
                active={activeAreaKind === k.id}
                onClick={() =>
                  sel?.layer === "zones" ? setKind(k.id) : setAreaKind(k.id)
                }
              >
                {k.label}
              </Chip>
            ))}
          {barFor === "path" &&
            PATH_KINDS.map((k) => (
              <Chip
                key={k.id}
                color={k.color}
                active={activePathKind === k.id}
                onClick={() =>
                  sel?.layer === "paths" ? setKind(k.id) : setPathKind(k.id)
                }
              >
                {k.label}
              </Chip>
            ))}
          {(barFor === "road" || barFor === "path") &&
            sel &&
            selected &&
            sel.layer !== "zones" && (
              <label className="flex items-center gap-2 px-2">
                Width
                <input
                  type="range"
                  min={1.5}
                  max={16}
                  step={0.5}
                  value={selected.w ?? 5}
                  onChange={(e) => setField("w", Number(e.target.value))}
                />
              </label>
            )}
          {barFor === "ring" && sel?.layer === "roundabouts" && selected && (
            <>
              <label className="flex items-center gap-2 px-2">
                Size
                <input
                  type="range"
                  min={4}
                  max={60}
                  step={0.5}
                  value={selected.r ?? 10}
                  onChange={(e) => setField("r", Number(e.target.value))}
                />
              </label>
              <label className="flex items-center gap-2 px-2">
                Road
                <input
                  type="range"
                  min={2}
                  max={14}
                  step={0.5}
                  value={selected.w ?? 6}
                  onChange={(e) => setField("w", Number(e.target.value))}
                />
              </label>
            </>
          )}
          {(barFor === "road" || barFor === "ring") && !sel && (
            <span className="px-2 text-muted-foreground">
              Snaps to roads, paths and roundabouts it touches
            </span>
          )}
        </div>
      )}

      {/* the actions, top right */}
      <div className="absolute top-5 right-5 flex items-center gap-1.5">
        {status && (
          <span className="rounded-lg bg-background/90 px-2 py-1 text-muted-foreground text-xs">
            {status}
          </span>
        )}
        <IconAction
          icon={Undo02Icon}
          label="Undo"
          disabled={!history.length}
          onClick={undo}
        />
        <IconAction
          icon={Redo02Icon}
          label="Redo"
          disabled={!future.length}
          onClick={redo}
        />
        <IconAction
          icon={Delete02Icon}
          label="Delete"
          disabled={!sel}
          onClick={removeSelected}
        />
        <label
          className="flex h-9 items-center rounded-xl corner-squircle bg-background/90 px-2.5 shadow-sm ring-1 ring-foreground/10 backdrop-blur"
          title="Satellite picture"
        >
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={satOpacity}
            onChange={(e) => setSatOpacity(Number(e.target.value))}
            className="w-20"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl corner-squircle bg-primary px-3.5 font-semibold text-primary-foreground text-sm shadow-sm disabled:opacity-40"
        >
          <Icon icon={FloppyDiskIcon} className="size-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-3 py-1.5 text-white text-xs">
        {hint}
      </p>
      {drawing && (
        <button
          type="button"
          onClick={cancelDraw}
          className="absolute bottom-5 left-5 grid size-9 place-items-center rounded-xl bg-black/70 text-white"
          aria-label="Cancel drawing"
        >
          <Icon icon={Cancel01Icon} className="size-4" />
        </button>
      )}
    </div>
  )
}

// the parts of the drawing this view edits
function lines(s: CampusShapes) {
  return {
    roads: s.roads,
    paths: s.paths,
    zones: s.zones,
    roundabouts: s.roundabouts,
  }
}
