"use client"

import { useEffect, useRef, useState } from "react"
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
type Selection = { layer: Layer; i: number; r?: number; v?: number }
type Drag =
  | { kind: "pan"; start: Point; view: View }
  | { kind: "move"; start: Point; orig: CampusShapes }
  | { kind: "vertex"; layer: Exclude<Layer, "buildings">; i: number; v: number }
  | { kind: "resize"; i: number; r: number }
  | { kind: "rotate"; i: number; r: number }

type View = { x: number; y: number; s: number }
const SIZE = 1312
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const MIN_POINTS: Record<Exclude<Layer, "buildings">, number> = {
  roads: 2,
  paths: 2,
  zones: 3,
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
  const [sel, setSel] = useState<Selection | null>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, s: SIZE })
  const [history, setHistory] = useState<CampusShapes[]>([])
  const [satOpacity, setSatOpacity] = useState(0.8)
  const [showPins, setShowPins] = useState(true)
  const [status, setStatus] = useState("")
  const [saving, setSaving] = useState(false)
  const [pxWidth, setPxWidth] = useState(800)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)

  const dirty = JSON.stringify(shapes) !== saved
  // one screen pixel in drawing units, so handles stay the same size at any zoom
  const px = view.s / pxWidth

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setPxWidth(el.clientWidth || 800))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // wheel zoom around the pointer (a React onWheel is passive, this has to prevent the page scroll)
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
      const target = event.target as HTMLElement
      if (/INPUT|SELECT|TEXTAREA/.test(target.tagName)) return
      if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault()
        undo()
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        removeSelected()
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

  function removeSelected() {
    if (!sel) return
    if (sel.layer !== "buildings" && sel.v !== undefined) {
      const line = shapes[sel.layer][sel.i]
      if (line.p.length > MIN_POINTS[sel.layer]) {
        change((d) =>
          d[sel.layer as Exclude<Layer, "buildings">][sel.i].p.splice(
            sel.v as number,
            1,
          ),
        )
        setSel({ layer: sel.layer, i: sel.i })
        return
      }
    }
    change((d) => (d[sel.layer] as unknown[]).splice(sel.i, 1))
    setSel(null)
  }

  // ---- pointer handling ----
  function startPan(event: React.PointerEvent) {
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
    drag.current = { kind: "pan", start: [event.clientX, event.clientY], view }
    setSel(null)
  }

  function startMove(event: React.PointerEvent, next: Selection) {
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    setSel(next)
    drag.current = { kind: "move", start: toSvg(event), orig: clone(shapes) }
  }

  function startHandle(event: React.PointerEvent, d: Drag) {
    event.stopPropagation()
    ;(svgRef.current as SVGSVGElement).setPointerCapture(event.pointerId)
    remember()
    drag.current = d
  }

  function onPointerMove(event: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    if (d.kind === "pan") {
      const k = d.view.s / pxWidth
      setView({
        s: d.view.s,
        x: d.view.x - (event.clientX - d.start[0]) * k,
        y: d.view.y - (event.clientY - d.start[1]) * k,
      })
      return
    }
    const p = toSvg(event)
    if (d.kind === "move" && sel) {
      const dx = p[0] - d.start[0]
      const dy = p[1] - d.start[1]
      const next = clone(d.orig)
      if (sel.layer === "buildings") {
        const rect = next.buildings[sel.i].r[sel.r ?? 0]
        rect[0] += dx
        rect[1] += dy
      } else {
        for (const q of next[sel.layer][sel.i].p) {
          q[0] += dx
          q[1] += dy
        }
      }
      setShapes(next)
    } else if (d.kind === "vertex") {
      setShapes((current) => {
        const next = clone(current)
        next[d.layer][d.i].p[d.v] = [p[0], p[1]]
        return next
      })
    } else if (d.kind === "resize" || d.kind === "rotate") {
      setShapes((current) => {
        const next = clone(current)
        const rect = next.buildings[d.i].r[d.r]
        const a = (rect[4] * Math.PI) / 180
        if (d.kind === "resize") {
          const lx =
            (p[0] - rect[0]) * Math.cos(a) + (p[1] - rect[1]) * Math.sin(a)
          const ly =
            -(p[0] - rect[0]) * Math.sin(a) + (p[1] - rect[1]) * Math.cos(a)
          rect[2] = Math.max(2, Math.abs(lx) * 2)
          rect[3] = Math.max(2, Math.abs(ly) * 2)
        } else {
          rect[4] =
            (Math.atan2(p[1] - rect[1], p[0] - rect[0]) * 180) / Math.PI + 90
        }
        return next
      })
    }
  }

  function onPointerUp() {
    drag.current = null
  }

  // ---- adding ----
  function add(layer: Layer) {
    const cx = view.x + view.s / 2
    const cy = view.y + view.s / 2
    const reach = view.s * 0.12
    change((d) => {
      if (layer === "buildings") d.buildings.push({ r: [[cx, cy, 24, 16, 0]] })
      else if (layer === "roads")
        d.roads.push({
          w: 6,
          p: [
            [cx - reach, cy],
            [cx, cy - reach / 3],
            [cx + reach, cy],
          ],
        })
      else if (layer === "paths")
        d.paths.push({
          w: 4,
          kind: "walk",
          p: [
            [cx - reach, cy],
            [cx, cy + reach / 3],
            [cx + reach, cy],
          ],
        })
      else
        d.zones.push({
          kind: "field",
          p: [
            [cx - 20, cy - 20],
            [cx + 20, cy - 20],
            [cx + 20, cy + 20],
            [cx - 20, cy + 20],
          ],
        })
    })
    // select the new one (always last)
    setSel({ layer, i: shapes[layer].length })
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
      // a pin is one building: taking it from another one first
      for (const building of d.buildings)
        if (building.id === pinId) delete building.id
      if (pinId) d.buildings[sel.i].id = pinId
      else delete d.buildings[sel.i].id
    })
  }

  const selectedBuilding =
    sel?.layer === "buildings" ? shapes.buildings[sel.i] : null
  const selectedRect = selectedBuilding ? selectedBuilding.r[sel?.r ?? 0] : null
  const linkedIds = new Set(shapes.buildings.map((b) => b.id).filter(Boolean))
  const unlinkedPins = pins.filter((pin) => !linkedIds.has(pin.id))

  function setRectField(index: number, value: number) {
    if (sel?.layer !== "buildings" || Number.isNaN(value)) return
    change((d) => {
      d.buildings[sel.i].r[sel.r ?? 0][index] = value
    })
  }

  const handleR = px * 6
  const stroke = px * 1.2

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col gap-2 p-2 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {(
            [
              ["buildings", "+ Building"],
              ["roads", "+ Road"],
              ["paths", "+ Path"],
              ["zones", "+ Zone"],
            ] as const
          ).map(([layer, label]) => (
            <button
              key={layer}
              type="button"
              onClick={() => add(layer)}
              className="rounded-full bg-foreground/10 px-3 py-1 hover:bg-foreground/20"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={undo}
            disabled={history.length === 0}
            className="rounded-full bg-foreground/10 px-3 py-1 disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => setView({ x: 0, y: 0, s: SIZE })}
            className="rounded-full bg-foreground/10 px-3 py-1"
          >
            Fit
          </button>
          <label className="flex items-center gap-1.5 px-2">
            Photo
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={satOpacity}
              onChange={(e) => setSatOpacity(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showPins}
              onChange={(e) => setShowPins(e.target.checked)}
            />
            Pins
          </label>
          <span className="ml-auto flex items-center gap-2">
            {status && (
              <span className="text-muted-foreground text-xs">{status}</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-full bg-primary px-4 py-1 font-semibold text-primary-foreground disabled:opacity-40"
            >
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
          </span>
        </div>

        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
          className="min-h-0 w-full flex-1 touch-none rounded-2xl bg-neutral-900"
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <title>Campus drawing</title>
          <rect
            x={-2000}
            y={-2000}
            width={6000}
            height={6000}
            fill="transparent"
            onPointerDown={startPan}
          />
          <image
            href="/auimap-1312.avif"
            width={SIZE}
            height={SIZE}
            opacity={satOpacity}
            pointerEvents="none"
          />

          {shapes.zones.map((zone, i) => (
            <polygon
              // biome-ignore lint/suspicious/noArrayIndexKey: shapes have no ids
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
                sel?.layer === "zones" && sel.i === i ? "#22d3ee" : "#ffffff"
              }
              strokeWidth={stroke}
              onPointerDown={(e) => startMove(e, { layer: "zones", i })}
            />
          ))}
          {(["paths", "roads"] as const).map((layer) =>
            shapes[layer].map((line, i) => (
              <path
                // biome-ignore lint/suspicious/noArrayIndexKey: shapes have no ids
                key={`${layer}${i}`}
                d={smoothPath(line.p)}
                fill="none"
                stroke={
                  sel?.layer === layer && sel.i === i
                    ? "#22d3ee"
                    : layer === "roads"
                      ? "#ffffff"
                      : "#f0d9a8"
                }
                strokeOpacity={0.9}
                strokeWidth={Math.max(line.w, px * 6)}
                strokeLinecap="round"
                strokeLinejoin="round"
                onPointerDown={(e) => startMove(e, { layer, i })}
              />
            )),
          )}
          {shapes.buildings.map((building, i) =>
            building.r.map((rect, r) => {
              const selected = sel?.layer === "buildings" && sel.i === i
              return (
                <rect
                  // biome-ignore lint/suspicious/noArrayIndexKey: shapes have no ids
                  key={`${i}-${r}`}
                  x={-rect[2] / 2}
                  y={-rect[3] / 2}
                  width={rect[2]}
                  height={rect[3]}
                  transform={`translate(${rect[0]} ${rect[1]}) rotate(${rect[4]})`}
                  fill={building.id ? "#ff7a45" : "#facc15"}
                  fillOpacity={0.55}
                  stroke={selected ? "#22d3ee" : "#ffffff"}
                  strokeWidth={selected && sel?.r === r ? stroke * 2 : stroke}
                  onPointerDown={(e) =>
                    startMove(e, { layer: "buildings", i, r })
                  }
                />
              )
            }),
          )}

          {showPins &&
            pins.map((pin) => (
              <g
                key={pin.id}
                onClick={() => sel?.layer === "buildings" && linkPin(pin.id)}
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
                <text
                  x={pin.x + handleR}
                  y={pin.y + handleR * 0.4}
                  fontSize={px * 11}
                  fill="#fff"
                  stroke="#000"
                  strokeWidth={px * 2.5}
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  {pin.id}
                </text>
              </g>
            ))}

          {/* handles for whatever is selected */}
          {sel?.layer === "buildings" &&
            selectedRect &&
            (() => {
              const [cx, cy, w, h, a] = selectedRect
              const rad = (a * Math.PI) / 180
              const ux = [Math.cos(rad), Math.sin(rad)]
              const uy = [-Math.sin(rad), Math.cos(rad)]
              const corner = [
                cx + (ux[0] * w) / 2 + (uy[0] * h) / 2,
                cy + (ux[1] * w) / 2 + (uy[1] * h) / 2,
              ]
              const top = [
                cx - uy[0] * (h / 2 + px * 22),
                cy - uy[1] * (h / 2 + px * 22),
              ]
              const edge = [cx - uy[0] * (h / 2), cy - uy[1] * (h / 2)]
              const r = sel.r ?? 0
              return (
                <g>
                  <line
                    x1={edge[0]}
                    y1={edge[1]}
                    x2={top[0]}
                    y2={top[1]}
                    stroke="#22d3ee"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={top[0]}
                    cy={top[1]}
                    r={handleR}
                    fill="#22d3ee"
                    onPointerDown={(e) =>
                      startHandle(e, { kind: "rotate", i: sel.i, r })
                    }
                    style={{ cursor: "grab" }}
                  />
                  <rect
                    x={corner[0] - handleR}
                    y={corner[1] - handleR}
                    width={handleR * 2}
                    height={handleR * 2}
                    fill="#22d3ee"
                    onPointerDown={(e) =>
                      startHandle(e, { kind: "resize", i: sel.i, r })
                    }
                    style={{ cursor: "nwse-resize" }}
                  />
                </g>
              )
            })()}
          {sel &&
            sel.layer !== "buildings" &&
            (() => {
              const layer = sel.layer
              const pts = shapes[layer][sel.i]?.p
              if (!pts) return null
              const closed = layer === "zones"
              const mids = pts.map((q, v) => {
                const nextPoint = pts[v + 1] ?? (closed ? pts[0] : null)
                return nextPoint
                  ? {
                      v,
                      at: [
                        (q[0] + nextPoint[0]) / 2,
                        (q[1] + nextPoint[1]) / 2,
                      ] as Point,
                    }
                  : null
              })
              return (
                <g>
                  {mids.map(
                    (mid) =>
                      mid && (
                        <circle
                          key={`m${mid.v}`}
                          cx={mid.at[0]}
                          cy={mid.at[1]}
                          r={handleR * 0.6}
                          fill="#ffffff"
                          fillOpacity={0.8}
                          stroke="#22d3ee"
                          strokeWidth={stroke}
                          style={{ cursor: "copy" }}
                          onPointerDown={(e) => {
                            // a new point in the middle of that stretch, picked up straight away
                            e.stopPropagation()
                            remember()
                            setShapes((current) => {
                              const next = clone(current)
                              next[layer][sel.i].p.splice(mid.v + 1, 0, mid.at)
                              return next
                            })
                            ;(
                              svgRef.current as SVGSVGElement
                            ).setPointerCapture(e.pointerId)
                            drag.current = {
                              kind: "vertex",
                              layer,
                              i: sel.i,
                              v: mid.v + 1,
                            }
                            setSel({ layer, i: sel.i, v: mid.v + 1 })
                          }}
                        />
                      ),
                  )}
                  {pts.map((q, v) => (
                    <circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: points have no ids
                      key={`v${v}`}
                      cx={q[0]}
                      cy={q[1]}
                      r={handleR}
                      fill={sel.v === v ? "#f43f5e" : "#22d3ee"}
                      stroke="#fff"
                      strokeWidth={stroke}
                      style={{ cursor: "grab" }}
                      onPointerDown={(e) => {
                        setSel({ layer, i: sel.i, v })
                        startHandle(e, { kind: "vertex", layer, i: sel.i, v })
                      }}
                      onDoubleClick={() => removeSelected()}
                    />
                  ))}
                </g>
              )
            })()}
        </svg>
      </div>

      <aside className="w-full shrink-0 space-y-3 overflow-y-auto text-sm lg:w-72">
        {!sel && (
          <p className="text-muted-foreground">
            Click a shape to edit it. Drag it to move. Drag empty space to pan,
            scroll to zoom. Orange buildings are linked to a pin, yellow ones
            aren't. With a building selected, click a pin dot to link it.
          </p>
        )}

        {selectedBuilding && sel && (
          <section className="space-y-2">
            <h2 className="font-medium">Building</h2>
            <label className="block space-y-1">
              <span className="text-muted-foreground">Linked pin</span>
              <select
                value={selectedBuilding.id ?? ""}
                onChange={(e) => linkPin(e.target.value)}
                className="w-full rounded-lg border bg-background px-2 py-1.5"
              >
                <option value="">No pin</option>
                {pins.map((pin) => (
                  <option key={pin.id} value={pin.id}>
                    {pin.title} ({pin.id})
                    {linkedIds.has(pin.id) && pin.id !== selectedBuilding.id
                      ? " ·linked"
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-muted-foreground text-xs">
              Rectangle {(sel.r ?? 0) + 1} of {selectedBuilding.r.length}. Blue
              square resizes, blue dot rotates.
            </p>
            {selectedRect && (
              <div className="grid grid-cols-5 gap-1">
                {(["x", "y", "w", "h", "°"] as const).map((label, index) => (
                  <label
                    key={label}
                    className="space-y-0.5 text-center text-muted-foreground text-xs"
                  >
                    {label}
                    <input
                      type="number"
                      step="0.5"
                      value={Math.round(selectedRect[index] * 10) / 10}
                      onChange={(e) =>
                        setRectField(index, Number(e.target.value))
                      }
                      className="w-full rounded-md border bg-background px-1 py-1 text-foreground"
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-full bg-foreground/10 px-3 py-1"
                onClick={() => {
                  const r = (selectedRect ?? [0, 0, 20, 14, 0]).slice() as Rect
                  r[0] += 10
                  r[1] += 10
                  change((d) => d.buildings[sel.i].r.push(r))
                  setSel({
                    layer: "buildings",
                    i: sel.i,
                    r: selectedBuilding.r.length,
                  })
                }}
              >
                + Rectangle
              </button>
              {selectedBuilding.r.length > 1 && (
                <button
                  type="button"
                  className="rounded-full bg-foreground/10 px-3 py-1"
                  onClick={() => {
                    change((d) => d.buildings[sel.i].r.splice(sel.r ?? 0, 1))
                    setSel({ layer: "buildings", i: sel.i, r: 0 })
                  }}
                >
                  Remove this rectangle
                </button>
              )}
              <button
                type="button"
                className="rounded-full bg-foreground/10 px-3 py-1"
                onClick={() => {
                  const copy: Building = {
                    r: clone(selectedBuilding.r).map(
                      (r) => [r[0] + 12, r[1] + 12, r[2], r[3], r[4]] as Rect,
                    ),
                  }
                  change((d) => d.buildings.push(copy))
                  setSel({ layer: "buildings", i: shapes.buildings.length })
                }}
              >
                Duplicate
              </button>
            </div>
          </section>
        )}

        {sel && sel.layer !== "buildings" && shapes[sel.layer][sel.i] && (
          <section className="space-y-2">
            <h2 className="font-medium capitalize">{sel.layer.slice(0, -1)}</h2>
            {sel.layer !== "zones" && (
              <label className="block space-y-1">
                <span className="text-muted-foreground">Width</span>
                <input
                  type="number"
                  step="0.5"
                  min={1}
                  value={(shapes[sel.layer][sel.i] as { w: number }).w}
                  onChange={(e) => {
                    const layer = sel.layer as "roads" | "paths"
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
                    const layer = sel.layer
                    change((d) => {
                      ;(
                        d[layer as "paths" | "zones"][sel.i] as { kind: string }
                      ).kind = e.target.value
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
            <p className="text-muted-foreground text-xs">
              Drag the blue dots. Drag a white dot to add a point. Double-click
              a point to remove it.
            </p>
          </section>
        )}

        {sel && (
          <button
            type="button"
            onClick={removeSelected}
            className="w-full rounded-full bg-destructive/15 px-3 py-1.5 text-destructive"
          >
            {sel.layer !== "buildings" && sel.v !== undefined
              ? "Delete point"
              : "Delete shape"}
          </button>
        )}

        <section className="space-y-1">
          <h2 className="font-medium">
            Pins without a building ({unlinkedPins.length})
          </h2>
          <div className="flex flex-wrap gap-1">
            {unlinkedPins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                title={pin.title}
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
