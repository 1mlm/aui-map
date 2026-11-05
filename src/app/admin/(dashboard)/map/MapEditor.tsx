// biome-ignore-all lint/suspicious/noArrayIndexKey: buildings and points have no ids, their position is their identity
"use client"

import {
  Add01Icon,
  Cancel01Icon,
  Copy01Icon,
  Cursor02Icon,
  Delete02Icon,
  Edit02Icon,
  FloppyDiskIcon,
  Image01Icon,
  Link01Icon,
  MapPinIcon,
  Maximize01Icon,
  Pentagon01Icon,
  SquareIcon,
  Tick02Icon,
  Undo02Icon,
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
  const [view, setView] = useState<View>({ x: 0, y: 0, s: SIZE })
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.8)
  const [showPins, setShowPins] = useState(true)
  // names inside buildings: only where they fit (auto), everywhere, or not at all
  const [names, setNames] = useState<"auto" | "all" | "off">("auto")
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)

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
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault()
        undo()
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

  function addRect() {
    change((d) =>
      d.buildings.push({
        r: [view.x + view.s / 2, view.y + view.s / 2, 24, 16, 0],
      }),
    )
    setSel({ i: shapes.buildings.length })
  }

  function removeSelected() {
    if (!sel) return
    const b = shapes.buildings[sel.i]
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
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel({ i })
    drag.current = { kind: "move", start: toSvg(event), orig: clone(shapes), i }
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
    if (tool !== "select") setCursor(p)
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
      const dx = p[0] - d.start[0]
      const dy = p[1] - d.start[1]
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
      setShapes((current) => {
        const next = clone(current)
        const pts = next.buildings[d.i].p
        if (pts) pts[d.v] = [p[0], p[1]]
        return next
      })
    } else if (d.kind === "rect") {
      setShapes((current) => {
        const next = clone(current)
        next.buildings[d.i].r = resizeRect(d.orig, p, d.sx, d.sy)
        return next
      })
    } else if (d.kind === "rotate") {
      setShapes((current) => {
        const next = clone(current)
        const rect = next.buildings[d.i].r
        if (rect)
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
        const at = toSvg(event)
        // clicking the first corner again closes the shape
        if (draft.length >= 3 && dist(at, draft[0]) < px * 10) finishDraw()
        else setDraft((current) => [...current, at])
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
  const unlinkedPins = pins.filter((pin) => !linkedIds.has(pin.id))

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
            onDoubleClick={() => removeSelected()}
          />
        ))}
      </g>
    )
  }

  const draftPoints = cursor && draft.length ? [...draft, cursor] : draft

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col gap-2 p-2 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
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
          <IconBtn
            icon={Undo02Icon}
            label="Undo"
            onClick={undo}
            disabled={history.length === 0}
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

            {shapes.buildings.map((b, i) => {
              const selected = sel?.i === i
              const common = {
                fill: b.id ? "#ff7a45" : "#facc15",
                fillOpacity: 0.55,
                stroke: selected ? "#06b6d4" : "#ffffff",
                strokeWidth: selected ? stroke * 2.2 : stroke,
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
              const shown = title.length > 20 ? `${title.slice(0, 19)}…` : title
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

            {/* handles of the selected building: a rectangle has edges and corners, plain vertices have points */}
            {tool === "select" &&
              building?.r &&
              sel &&
              rectHandles(sel.i, building.r)}
            {tool === "select" &&
              building?.p &&
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
                ? "Click each corner of the building. Click the first one, double-click or press Enter to finish"
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

            {building.r && (
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
                        value={
                          Math.round((building.r as Rect)[index] * 10) / 10
                        }
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
              {building.r ? (
                <IconBtn
                  icon={Pentagon01Icon}
                  label="Edit as vertices"
                  showLabel
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
                icon={Copy01Icon}
                label="Duplicate"
                showLabel
                onClick={() => {
                  const copy = clone(building)
                  delete copy.id
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
