// biome-ignore-all lint/suspicious/noArrayIndexKey: lines have no ids, their position is their identity
"use client"

import {
  Cancel01Icon,
  Cursor02Icon,
  Delete02Icon,
  FloppyDiskIcon,
  Redo02Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import {
  type CampusShapes,
  type Point,
  rectToPolygon,
  smoothPath,
} from "@/map/campusShapes"
import { saveCampusLines } from "../map/actions"

const SIZE = 1312
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

type Layer = "roads" | "paths" | "zones"
type Tool = "select" | "road" | "walk" | "dirt" | "field" | "court" | "parking"
type Sel = { layer: Layer; i: number; v?: number }
type View = { x: number; y: number; s: number }
type Drag =
  | { kind: "pan"; start: [number, number]; view: View; moved: boolean }
  | { kind: "vertex"; sel: Sel & { v: number } }
  | { kind: "move"; start: Point; orig: CampusShapes; sel: Sel }

const TOOLS: { id: Tool; label: string; color: string }[] = [
  { id: "road", label: "Road", color: "#fffdf6" },
  { id: "walk", label: "Footpath", color: "#f6eed9" },
  { id: "dirt", label: "Dirt path", color: "#d8bf92" },
  { id: "field", label: "Field", color: "#a9d18f" },
  { id: "court", label: "Court", color: "#d98a68" },
  { id: "parking", label: "Parking", color: "#c9ccd0" },
]
const isZoneTool = (tool: Tool) =>
  tool === "field" || tool === "court" || tool === "parking"
const DEFAULT_WIDTH: Partial<Record<Tool, number>> = {
  road: 7,
  walk: 3.5,
  dirt: 3,
}
const ZONE_FILL = { field: "#a9d18f", court: "#d98a68", parking: "#c9ccd0" }

function ToolButton({
  icon,
  label,
  active,
  onClick,
  disabled,
  color,
}: {
  icon?: HugeIcon
  label: string
  active?: boolean
  onClick: () => void
  disabled?: boolean
  color?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center gap-1.5 rounded-xl corner-squircle px-3 py-1.5 text-sm transition-colors disabled:opacity-40 ${
        active
          ? "bg-primary font-semibold text-primary-foreground"
          : "bg-foreground/10 hover:bg-foreground/20"
      }`}
    >
      {color && (
        <span
          className="size-3.5 rounded-[0.3rem] ring-1 ring-black/20"
          style={{ background: color }}
        />
      )}
      {icon && <Icon icon={icon} className="size-4" />}
      {label}
    </button>
  )
}

function buildingPoints(shapes: CampusShapes) {
  return shapes.buildings.map((b) => (b.r ? rectToPolygon(b.r) : (b.p ?? [])))
}

export function RoadsEditor({ initial }: { initial: CampusShapes }) {
  const [shapes, setShapes] = useState(initial)
  const [saved, setSaved] = useState(() => JSON.stringify(initial))
  const [tool, setTool] = useState<Tool>("select")
  const [draft, setDraft] = useState<Point[]>([])
  const [cursor, setCursor] = useState<Point | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [view, setView] = useState<View>({ x: 180, y: 120, s: 940 })
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [future, setFuture] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.8)
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)

  const dirty =
    JSON.stringify({
      roads: shapes.roads,
      paths: shapes.paths,
      zones: shapes.zones,
    }) !==
    JSON.stringify({
      roads: JSON.parse(saved).roads,
      paths: JSON.parse(saved).paths,
      zones: JSON.parse(saved).zones,
    })
  const px = view.s / pxWidth
  const handleR = px * 6

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
        if (tool !== "select") cancelDraw()
        else setSel(null)
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

  // a new point sticks to a nearby existing point, so roads that meet really meet
  function snapPoint(raw: Point, free: boolean): Point {
    if (free) return raw
    let best: Point | null = null
    let bestD = px * 9
    const all = [
      ...shapes.roads.flatMap((r) => r.p),
      ...shapes.paths.flatMap((r) => r.p),
      ...shapes.zones.flatMap((z) => z.p),
      ...buildingPoints(shapes).flat(),
      ...draft,
    ]
    for (const q of all) {
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
    setSel(null)
    setTool(next)
  }
  function cancelDraw() {
    setDraft([])
    setTool("select")
  }
  function finishDraw() {
    const pts = draft.filter(
      (q, k) => k === 0 || dist(q, draft[k - 1]) > px * 2,
    )
    const need = isZoneTool(tool) ? 3 : 2
    if (pts.length < need) {
      setDraft([])
      return
    }
    if (tool === "road")
      change((d) => d.roads.push({ w: DEFAULT_WIDTH.road ?? 7, p: pts }))
    else if (tool === "walk" || tool === "dirt")
      change((d) =>
        d.paths.push({
          w: DEFAULT_WIDTH[tool] ?? 3,
          kind: tool === "dirt" ? "dirt" : "walk",
          p: pts,
        }),
      )
    else if (isZoneTool(tool))
      change((d) => d.zones.push({ kind: tool as "field", p: pts }))
    setDraft([])
  }

  function removeSelected() {
    if (!sel) return
    const list = shapes[sel.layer]
    const entry = list[sel.i] as { p: Point[] } | undefined
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

  function setWidth(width: number) {
    if (!sel || sel.layer === "zones") return
    const layer = sel.layer
    change((d) => {
      ;(d[layer][sel.i] as { w: number }).w = width
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
    if (tool !== "select") setCursor(snapPoint(raw, event.altKey))
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
        const entry = next[d.sel.layer][d.sel.i] as { p: Point[] }
        entry.p = entry.p.map(([x, y]) => [x + dx, y + dy] as Point)
        return next
      })
    } else if (d.kind === "vertex") {
      const at = snapPoint(raw, event.altKey)
      const { layer, i, v } = d.sel
      setShapes((current) => {
        const next = clone(current)
        ;(next[layer][i] as { p: Point[] }).p[v] = at
        return next
      })
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    const d = drag.current
    drag.current = null
    if (d?.kind === "pan" && !d.moved) {
      if (tool === "select") setSel(null)
      else {
        const at = snapPoint(toSvg(event), event.altKey)
        // clicking the last point again finishes the line
        if (draft.length >= 2 && dist(at, draft[draft.length - 1]) < px * 4)
          finishDraw()
        else if (
          isZoneTool(tool) &&
          draft.length >= 3 &&
          dist(at, draft[0]) < px * 10
        )
          finishDraw()
        else setDraft((current) => [...current, at])
      }
    }
  }

  // a point added halfway along a side: a fresh vertex the line can be bent at
  function addMidpoint(layer: Layer, i: number, after: number) {
    const entry = shapes[layer][i] as { p: Point[] }
    const a = entry.p[after]
    const b = entry.p[(after + 1) % entry.p.length]
    change((d) => {
      ;(d[layer][i] as { p: Point[] }).p.splice(after + 1, 0, [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      ])
    })
    setSel({ layer, i, v: after + 1 })
  }

  async function save() {
    setSaving(true)
    setStatus("")
    const result = await saveCampusLines({
      roads: shapes.roads,
      paths: shapes.paths,
      zones: shapes.zones,
    })
    setSaving(false)
    if ("error" in result) setStatus(result.error)
    else {
      setSaved(JSON.stringify(shapes))
      setStatus("Saved. The public map picture updates within a minute.")
    }
  }

  const selectedEntry = sel
    ? (shapes[sel.layer][sel.i] as { p: Point[]; w?: number } | undefined)
    : undefined
  const drawing = tool !== "select"
  const draftPoints = cursor && drawing ? [...draft, cursor] : draft

  function renderEditable(layer: Layer, i: number) {
    const entry = shapes[layer][i] as { p: Point[]; w?: number; kind?: string }
    const selected = sel?.layer === layer && sel.i === i
    const closed = layer === "zones"
    const d = closed
      ? `M${entry.p.map((q) => q.join(" ")).join("L")}Z`
      : smoothPath(entry.p)
    return (
      <g key={`${layer}-${i}`}>
        {layer === "zones" ? (
          <path
            d={d}
            fill={ZONE_FILL[(entry.kind as keyof typeof ZONE_FILL) ?? "field"]}
            fillOpacity={0.6}
            stroke={selected ? "#fff" : "rgba(0,0,0,0.4)"}
            strokeWidth={px * (selected ? 2 : 1)}
            pointerEvents="none"
          />
        ) : (
          <>
            <path
              d={d}
              fill="none"
              stroke="#b8b3a4"
              strokeWidth={(entry.w ?? 5) + 2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
              pointerEvents="none"
            />
            <path
              d={d}
              fill="none"
              stroke={
                layer === "roads"
                  ? "#fffdf6"
                  : entry.kind === "dirt"
                    ? "#d8bf92"
                    : "#f6eed9"
              }
              strokeWidth={entry.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {selected && (
              <path
                d={d}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={px * 1.5}
                strokeDasharray={`${px * 4} ${px * 3}`}
                pointerEvents="none"
              />
            )}
          </>
        )}
        {/* a wide invisible stroke so thin lines are easy to grab */}
        <path
          d={closed ? d : d}
          fill={closed ? "transparent" : "none"}
          stroke="transparent"
          strokeWidth={Math.max(px * 14, (entry.w ?? 0) + 4)}
          strokeLinecap="round"
          onPointerDown={(e) => startMove(e, layer, i)}
          // while drawing, clicks go through to the drawing instead of grabbing the road underneath
          pointerEvents={tool === "select" ? undefined : "none"}
          style={{ cursor: tool === "select" ? "move" : "crosshair" }}
        />
        {selected && tool === "select" && (
          <>
            {entry.p.map((q, v) => {
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
                      fillOpacity={0.55}
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
          </>
        )}
      </g>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-[32rem] flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ToolButton
          icon={Cursor02Icon}
          label="Select"
          active={tool === "select"}
          onClick={() => pickTool("select")}
        />
        {TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            label={t.label}
            color={t.color}
            active={tool === t.id}
            onClick={() => pickTool(t.id)}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-foreground/15" />
        <ToolButton
          icon={Undo02Icon}
          label="Undo"
          disabled={!history.length}
          onClick={undo}
        />
        <ToolButton
          icon={Redo02Icon}
          label="Redo"
          disabled={!future.length}
          onClick={redo}
        />
        <ToolButton
          icon={Delete02Icon}
          label="Delete"
          disabled={!sel}
          onClick={removeSelected}
        />
        <label className="ml-1 flex items-center gap-2 text-muted-foreground text-xs">
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={satOpacity}
            onChange={(e) => setSatOpacity(Number(e.target.value))}
          />
          Satellite
        </label>
        {sel && selectedEntry && sel.layer !== "zones" && (
          <label className="flex items-center gap-2 text-sm">
            Width
            <input
              type="range"
              min={1.5}
              max={16}
              step={0.5}
              value={selectedEntry.w ?? 5}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>
        )}
        <span className="flex-1" />
        {status && (
          <span className="text-muted-foreground text-xs">{status}</span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-1.5 rounded-xl corner-squircle bg-primary px-4 py-1.5 font-semibold text-primary-foreground text-sm disabled:opacity-40"
        >
          <Icon icon={FloppyDiskIcon} className="size-4" />
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
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
            if (drawing) finishDraw()
            else if (sel?.v !== undefined) removeSelected()
          }}
        >
          <title>Roads</title>
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

          {/* the buildings, to line the roads up with. Not editable here */}
          {buildingPoints(shapes).map((pts, i) => (
            <path
              key={`b-${i}`}
              d={`M${pts.map((q) => q.join(" ")).join("L")}Z`}
              fill="rgba(217,128,95,0.35)"
              stroke="rgba(156,79,56,0.8)"
              strokeWidth={px}
              pointerEvents="none"
              onPointerDown={onBackgroundDown}
            />
          ))}

          {shapes.zones.map((_, i) => renderEditable("zones", i))}
          {shapes.paths.map((_, i) => renderEditable("paths", i))}
          {shapes.roads.map((_, i) => renderEditable("roads", i))}

          {drawing && draftPoints.length > 0 && (
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

        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl bg-black/70 px-3 py-1.5 text-white text-xs">
          {drawing
            ? "Click to add points. Enter or double click to finish. Esc cancels. Points stick to nearby ones, hold Alt to skip"
            : "Click a road to edit it. Drag a square to move a point, drag a small circle to add one. Scroll to zoom"}
        </p>
        {drawing && (
          <button
            type="button"
            onClick={cancelDraw}
            className="absolute top-3 right-3 grid size-9 place-items-center rounded-xl bg-black/70 text-white"
            aria-label="Cancel drawing"
          >
            <Icon icon={Cancel01Icon} className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
