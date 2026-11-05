"use client"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { latLongToPosition } from "@/map/geo"
import { tagPinFillColor } from "@/map/tagColor"
import type { MapItem, MapItemTag } from "@/map/types"
import { DETAIL_PIN_SCALE } from "@/map/types"

const BASE = 1312
// the picture is drawn at twice the size of the stitched satellite image so pins and text stay sharp
const SCALE = 2
const W = BASE * SCALE
// the Michlifen hotel sits in the bottom left, it is not part of the campus, so the legend covers it
const HOTEL = { x: 0.02, y: 0.69, w: 0.47, h: 0.29 }
const COMPASS = [
  ["N", 0],
  ["NE", 45],
  ["E", 90],
  ["SE", 135],
  ["S", 180],
  ["SW", 225],
  ["W", 270],
  ["NW", 315],
] as const

type Here = { x: number; y: number; angle: number }
type IconNode = [string, Record<string, string>]

// a hugeicons icon (a list of svg parts on a 24 grid) drawn with the canvas, centred on 0,0
function drawIcon(
  ctx: CanvasRenderingContext2D,
  icon: IconNode[],
  size: number,
  color: string,
) {
  ctx.save()
  const k = size / 24
  ctx.scale(k, k)
  ctx.translate(-12, -12)
  ctx.strokeStyle = color
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  for (const [name, a] of icon) {
    ctx.lineWidth = Number(a.strokeWidth ?? 1.5) * 1.15
    const n = (key: string) => Number(a[key] ?? 0)
    let d: string | null = null
    if (name === "path") d = a.d
    else if (name === "circle")
      d = `M${n("cx") - n("r")} ${n("cy")}a${n("r")} ${n("r")} 0 1 0 ${n("r") * 2} 0a${n("r")} ${n("r")} 0 1 0 ${-n("r") * 2} 0`
    else if (name === "ellipse")
      d = `M${n("cx") - n("rx")} ${n("cy")}a${n("rx")} ${n("ry")} 0 1 0 ${n("rx") * 2} 0a${n("rx")} ${n("ry")} 0 1 0 ${-n("rx") * 2} 0`
    else if (name === "rect")
      d = `M${n("x")} ${n("y")}h${n("width")}v${n("height")}h${-n("width")}Z`
    else if (name === "line") d = `M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`
    else if (name === "polyline" || name === "polygon")
      d = `M${a.points}${name === "polygon" ? "Z" : ""}`
    if (d) ctx.stroke(new Path2D(d))
  }
  ctx.restore()
}

// a map pin standing on x,y: the teardrop, a white rim and the category icon inside
function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  icon: IconNode[],
) {
  const cy = -1.75 * r
  const a = Math.acos(r / (1.75 * r))
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = "rgba(0,0,0,0.35)"
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.9, r * 0.35, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(r * Math.sin(a), cy + r * Math.cos(a))
  ctx.arc(0, cy, r, Math.PI / 2 - a, Math.PI / 2 + a, true)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = r * 0.14
  ctx.strokeStyle = "rgba(255,255,255,0.92)"
  ctx.stroke()
  ctx.translate(0, cy)
  drawIcon(ctx, icon, r * 1.25, "white")
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export function MapImageMaker({
  items,
  tags,
}: {
  items: MapItem[]
  tags: MapItemTag[]
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [showPins, setShowPins] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [showNames, setShowNames] = useState(false)
  const [showLegend, setShowLegend] = useState(true)
  const [here, setHere] = useState<Here | null>(null)
  const [pinId, setPinId] = useState("")

  useEffect(() => {
    const img = new Image()
    img.src = "/auimap-1312.webp"
    img.onload = () => setImage(img)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = W
    canvas.height = W
    ctx.drawImage(image, 0, 0, W, W)

    const visible = items.filter(
      (item) => showDetails || item.tag.sizeScale > DETAIL_PIN_SCALE,
    )
    if (showPins)
      // north to south, so a pin further down is drawn over the one behind it
      for (const item of [...visible].sort((a, b) => b.latitude - a.latitude)) {
        const [nx, ny] = latLongToPosition(item.latitude, item.longitude)
        const r = 8.5 * SCALE * item.tag.sizeScale
        drawPin(
          ctx,
          nx * W,
          ny * W,
          r,
          tagPinFillColor(item.tag.color),
          item.tag.icon as unknown as IconNode[],
        )
        if (showNames) {
          ctx.font = `600 ${11 * SCALE}px sans-serif`
          ctx.lineWidth = 3 * SCALE
          ctx.strokeStyle = "rgba(0,0,0,0.75)"
          ctx.fillStyle = "white"
          ctx.lineJoin = "round"
          ctx.strokeText(item.title, nx * W + r * 1.4, ny * W - r * 1.2)
          ctx.fillText(item.title, nx * W + r * 1.4, ny * W - r * 1.2)
        }
      }

    // the legend: one row per colour, with the categories that use it. It sits over the hotel
    if (showLegend) {
      const groups = new Map<string, string[]>()
      for (const tag of tags) {
        const color = tagPinFillColor(tag.color)
        groups.set(color, [...(groups.get(color) ?? []), tag.label])
      }
      const x = HOTEL.x * W
      const y = HOTEL.y * W
      const w = HOTEL.w * W
      const h = HOTEL.h * W
      roundRect(ctx, x, y, w, h, 34 * SCALE)
      ctx.fillStyle = "rgb(18,30,22)"
      ctx.fill()
      ctx.lineWidth = 2 * SCALE
      ctx.strokeStyle = "rgba(255,255,255,0.18)"
      ctx.stroke()
      const rows = [...groups.entries()]
      const rowH = Math.min(70 * SCALE, (h - 40 * SCALE) / rows.length)
      rows.forEach(([color, labels], k) => {
        const cy = y + 20 * SCALE + rowH * k + rowH / 2
        drawPin(ctx, x + 50 * SCALE, cy + 14 * SCALE, 12 * SCALE, color, [])
        ctx.fillStyle = "white"
        ctx.font = `600 ${22 * SCALE}px sans-serif`
        ctx.textBaseline = "middle"
        ctx.fillText(labels.join("  ·  "), x + 84 * SCALE, cy)
      })
      ctx.textBaseline = "alphabetic"
    }

    // north arrow, top right
    ctx.save()
    ctx.translate(W - 60 * SCALE, 60 * SCALE)
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.beginPath()
    ctx.arc(0, 0, 30 * SCALE, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#1f2a24"
    ctx.beginPath()
    ctx.moveTo(0, -22 * SCALE)
    ctx.lineTo(9 * SCALE, 8 * SCALE)
    ctx.lineTo(0, 2 * SCALE)
    ctx.lineTo(-9 * SCALE, 8 * SCALE)
    ctx.closePath()
    ctx.fill()
    ctx.font = `700 ${12 * SCALE}px sans-serif`
    ctx.textAlign = "center"
    ctx.fillText("N", 0, 22 * SCALE)
    ctx.restore()

    // you are here: a dot with a wedge showing which way you face
    if (here) {
      const cx = here.x * W
      const cy = here.y * W
      const rad = ((here.angle - 90) * Math.PI) / 180
      ctx.save()
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 70 * SCALE)
      grad.addColorStop(0, "rgba(37,99,235,0.75)")
      grad.addColorStop(1, "rgba(37,99,235,0)")
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, 70 * SCALE, rad - 0.55, rad + 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.beginPath()
      ctx.arc(cx, cy, 11 * SCALE, 0, Math.PI * 2)
      ctx.fillStyle = "#2563eb"
      ctx.fill()
      ctx.lineWidth = 4 * SCALE
      ctx.strokeStyle = "white"
      ctx.stroke()
      ctx.font = `700 ${18 * SCALE}px sans-serif`
      const label = "You are here"
      const tw = ctx.measureText(label).width
      roundRect(
        ctx,
        cx - tw / 2 - 12 * SCALE,
        cy + 20 * SCALE,
        tw + 24 * SCALE,
        32 * SCALE,
        12 * SCALE,
      )
      ctx.fillStyle = "#2563eb"
      ctx.fill()
      ctx.fillStyle = "white"
      ctx.textAlign = "center"
      ctx.fillText(label, cx, cy + 43 * SCALE)
      ctx.restore()
    }

    // credit, bottom right
    ctx.font = `700 ${15 * SCALE}px sans-serif`
    const credit = "auimap.ma"
    const cw = ctx.measureText(credit).width
    roundRect(
      ctx,
      W - cw - 44 * SCALE,
      W - 52 * SCALE,
      cw + 28 * SCALE,
      34 * SCALE,
      12 * SCALE,
    )
    ctx.fillStyle = "rgba(18,30,22,0.85)"
    ctx.fill()
    ctx.fillStyle = "white"
    ctx.textAlign = "left"
    ctx.fillText(credit, W - cw - 30 * SCALE, W - 28 * SCALE)
  }, [image, items, tags, showPins, showDetails, showNames, showLegend, here])

  function placeFromClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    setPinId("")
    setHere((current) => ({
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
      angle: current?.angle ?? 0,
    }))
  }

  function placeAtPin(id: string) {
    setPinId(id)
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return setHere(null)
    const [x, y] = latLongToPosition(item.latitude, item.longitude)
    setHere((current) => ({ x, y, angle: current?.angle ?? 0 }))
  }

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "aui-map.png"
      link.click()
      URL.revokeObjectURL(url)
    }, "image/png")
  }

  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => set(e.target.checked)}
      />
      {label}
    </label>
  )

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:flex-row">
      <div className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center justify-center gap-2 rounded-2xl corner-squircle bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          <Icon icon={Download01Icon} className="size-5" />
          Download
        </button>
        <div className="flex flex-col gap-2 rounded-2xl corner-squircle bg-foreground/5 p-3">
          {toggle("Pins", showPins, setShowPins)}
          {toggle(
            "Small places (restrooms, printers)",
            showDetails,
            setShowDetails,
          )}
          {toggle("Names", showNames, setShowNames)}
          {toggle("Legend over the hotel", showLegend, setShowLegend)}
        </div>
        <div className="flex flex-col gap-3 rounded-2xl corner-squircle bg-foreground/5 p-3">
          <span className="font-semibold text-sm">You are here</span>
          <select
            value={pinId}
            onChange={(e) => placeAtPin(e.target.value)}
            className="rounded-xl corner-squircle border bg-background px-2.5 py-2 text-sm"
          >
            <option value="">Click the picture, or pick a place</option>
            {[...items]
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
          {here && (
            <>
              <div className="grid grid-cols-4 gap-1.5">
                {COMPASS.map(([label, angle]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHere({ ...here, angle })}
                    className={`rounded-xl corner-squircle py-1.5 text-xs font-semibold ${
                      here.angle === angle
                        ? "bg-primary text-primary-foreground"
                        : "bg-foreground/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={0}
                max={359}
                value={here.angle}
                onChange={(e) =>
                  setHere({ ...here, angle: Number(e.target.value) })
                }
              />
              <button
                type="button"
                onClick={() => {
                  setHere(null)
                  setPinId("")
                }}
                className="rounded-xl corner-squircle bg-foreground/10 py-1.5 text-sm"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <canvas
          ref={canvasRef}
          onClick={placeFromClick}
          className="aspect-square w-full cursor-crosshair rounded-2xl bg-neutral-900"
        />
      </div>
    </div>
  )
}
