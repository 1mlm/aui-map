"use client"

import { Download01Icon } from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import {
  buildCampusSvg,
  type CampusShapes,
  rectToPolygon,
} from "@/map/campusShapes"
import { latLongToPosition } from "@/map/geo"
import { tagPinFillColor } from "@/map/tagColor"
import type { MapItem, MapItemTag } from "@/map/types"
import { DETAIL_PIN_SCALE } from "@/map/types"

// Everything below is in the satellite picture's own pixels (1312 wide). The canvas draws it at
// SCALE times that, the svg uses the same numbers as its units
const BASE = 1312
const SCALE = 2
// the Michlifen hotel sits in the bottom left, it is not part of the campus: the picture fades out
// around the campus, so it drops away instead of showing
const HOTEL = { x: 0.02, y: 0.69, w: 0.47, h: 0.29 }
// the same teardrop the map itself uses (hugeicons Location02, on a 24 grid, tip at y = 22)
const PIN_D =
  "M13.6177 21.367C13.1841 21.773 12.6044 22 12.0011 22C11.3978 22 10.8182 21.773 10.3845 21.367C6.41302 17.626 1.09076 13.4469 3.68627 7.37966C5.08963 4.09916 8.45834 2 12.0011 2C15.5439 2 18.9126 4.09916 20.316 7.37966C22.9082 13.4393 17.599 17.6389 13.6177 21.367Z"
const PIN_PATH = new Path2D(PIN_D)
const PIN_H = 27
const LABEL_FONT = 10.5
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
type Rect = { x: number; y: number; w: number; h: number }
type Style = "satellite" | "vector"

type Scene = {
  crop: Rect
  pins: { x: number; y: number; size: number; fill: string; icon: IconNode[] }[]
  labels: { text: string; x: number; y: number }[]
  legend: {
    rect: Rect
    rows: {
      x: number
      y: number
      fill: string
      icon: IconNode[]
      text: string
    }[]
  } | null
  footer: {
    rect: Rect
    textX: number
    y1: number
    y2: number
    partA: string
    partB: string
    partBX: number
    line2: string
    logo: Rect
    ink2: string
  } | null
  here: Here | null
  ink: string
  fade: boolean
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// a hugeicons icon (a list of svg parts on a 24 grid) as svg path data, one entry per part
function iconParts(icon: IconNode[]) {
  return icon.flatMap(([name, a]) => {
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
    return d ? [{ d, width: Number(a.strokeWidth ?? 1.5) * 1.15 }] : []
  })
}

// ---------------------------------------------------------------- the scene

function measureText(font: string, text: string) {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return text.length * 6
  ctx.font = font
  return ctx.measureText(text).width
}

function buildScene({
  items,
  tags,
  showPins,
  showDetails,
  showNames,
  showLegend,
  fade,
  darkText,
  here,
  stamp,
}: {
  items: MapItem[]
  tags: MapItemTag[]
  showPins: boolean
  showDetails: boolean
  showNames: boolean
  showLegend: boolean
  fade: boolean
  darkText: boolean
  here: Here | null
  stamp: Date
}): Scene {
  const pos = (item: MapItem) => {
    const [nx, ny] = latLongToPosition(item.latitude, item.longitude)
    return { x: nx * BASE, y: ny * BASE }
  }
  const main = items.filter((item) => item.tag.sizeScale > DETAIL_PIN_SCALE)
  const visible = showDetails ? items : main

  // the picture is cut to the campus: from the housing in the top left to the new field and the
  // main entrance in the bottom right, with a little air around it
  const xs = main.map((item) => pos(item).x)
  const ys = main.map((item) => pos(item).y)
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - 80))
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - 90))
  const x1 = Math.min(BASE, Math.ceil(Math.max(...xs) + 80))
  const y1 = Math.min(BASE, Math.ceil(Math.max(...ys) + 110))
  const crop: Rect = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }

  const ink = fade && darkText ? "#16231b" : "white"
  const pinSize = (item: MapItem) => PIN_H * item.tag.sizeScale
  const pins = showPins
    ? [...visible]
        // north to south, so a pin further down is drawn over the one behind it
        .sort((a, b) => b.latitude - a.latitude)
        .map((item) => ({
          ...pos(item),
          size: pinSize(item),
          fill: tagPinFillColor(item.tag.color),
          icon: item.tag.icon as unknown as IconNode[],
        }))
    : []

  // the legend and the credit are one block in the bottom left, roughly centred in the empty
  // space beside the campus: one pin per category with its name, then where the app lives and
  // when this picture was made
  const shownTags = tags.filter((tag) =>
    visible.some((item) => item.tag.id === tag.id),
  )
  const cols = shownTags.length > 5 ? 2 : 1
  const perCol = Math.ceil(shownTags.length / cols)
  const rowH = 31
  const legendFont = "600 10.5px sans-serif"
  const colW =
    Math.max(...shownTags.map((tag) => measureText(legendFont, tag.label))) + 46
  const legendW = cols * colW + 8
  const legendH = perCol * rowH + 16

  const partA = "Interactive app on"
  const partB = "auimap.ma"
  const line2 = `Last generated: ${stamp.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
  const wA = measureText("700 9.5px sans-serif", partA)
  const wB = measureText("700 9.5px sans-serif", partB)
  const logoSize = 12
  const line1W = wA + 4 + logoSize + 4 + wB
  const footerW = Math.max(line1W, measureText("500 8px sans-serif", line2))
  const footerH = 28

  const blockW = Math.max(legendW, footerW + 16)
  const blockX = Math.max(crop.x + 24, crop.x + crop.w * 0.27 - blockW / 2)
  const footerTop = crop.y + crop.h - 70 - footerH
  const legendRect: Rect = {
    x: blockX,
    y: footerTop - 14 - legendH,
    w: legendW,
    h: legendH,
  }
  const legend = showLegend
    ? {
        rect: legendRect,
        rows: shownTags.map((tag, k) => ({
          x: legendRect.x + 16 + Math.floor(k / perCol) * colW,
          y: legendRect.y + 8 + (k % perCol) * rowH + rowH / 2,
          fill: tagPinFillColor(tag.color),
          icon: tag.icon as unknown as IconNode[],
          text: tag.label,
        })),
      }
    : null

  const textX = blockX + 8
  const lineY = footerTop + 7
  const footerRect: Rect = {
    x: textX - 6,
    y: footerTop - 4,
    w: footerW + 12,
    h: footerH + 8,
  }
  const footer = {
    rect: footerRect,
    textX,
    y1: lineY,
    y2: lineY + 14,
    partA,
    partB,
    partBX: textX + wA + 4 + logoSize + 4,
    line2,
    logo: {
      x: textX + wA + 4,
      y: lineY - logoSize / 2,
      w: logoSize,
      h: logoSize,
    },
    ink2: fade && darkText ? "rgba(22,35,27,0.62)" : "rgba(255,255,255,0.75)",
  }

  // names: each goes to the first side of its pin where it fits and is left out when nothing is
  // free, so labels never pile up on each other, on the pins or on the legend
  const labels: Scene["labels"] = []
  if (showPins && showNames) {
    const pinRects = visible.map((item) => {
      const { x, y } = pos(item)
      const s = pinSize(item)
      return {
        id: item.id,
        rect: { x: x - s * 0.4, y: y - s, w: s * 0.8, h: s },
      }
    })
    const taken: Rect[] = [footerRect]
    if (showLegend) taken.push(legendRect)
    if (here) taken.push({ x: here.x - 46, y: here.y - 9, w: 92, h: 42 })
    const font = `600 ${LABEL_FONT}px sans-serif`
    const order = [...visible].sort(
      (a, b) =>
        b.tag.sizeScale - a.tag.sizeScale ||
        a.shortestName.length - b.shortestName.length,
    )
    for (const item of order) {
      const { x, y } = pos(item)
      const s = pinSize(item)
      const tw = measureText(font, item.shortestName)
      const th = LABEL_FONT * 1.15
      const headY = y - s * 0.55
      const gap = 3
      const spots: Rect[] = [
        { x: x + s * 0.42 + gap, y: headY - th / 2, w: tw, h: th },
        { x: x - s * 0.42 - gap - tw, y: headY - th / 2, w: tw, h: th },
        { x: x - tw / 2, y: y + gap, w: tw, h: th },
        { x: x - tw / 2, y: y - s - gap - th, w: tw, h: th },
      ]
      const pad = 1.5
      const free = spots.find((spot) => {
        const box = {
          x: spot.x - pad,
          y: spot.y - pad,
          w: spot.w + pad * 2,
          h: spot.h + pad * 2,
        }
        return (
          !taken.some((other) => overlaps(box, other)) &&
          !pinRects.some(
            ({ id, rect }) => id !== item.id && overlaps(box, rect),
          )
        )
      })
      if (!free) continue
      taken.push(free)
      labels.push({ text: item.shortestName, x: free.x, y: free.y + th / 2 })
    }
  }

  return { crop, pins, labels, legend, footer, here, ink, fade }
}

// ------------------------------------------------------ the soft shape around the campus

type MaskPiece = { pts: [number, number][]; fill: boolean; width: number }

function maskPieces(shapes: CampusShapes): MaskPiece[] {
  const k = BASE / shapes.size
  const hotel = {
    x0: HOTEL.x * BASE,
    x1: (HOTEL.x + HOTEL.w) * BASE,
    y0: HOTEL.y * BASE,
    y1: (HOTEL.y + HOTEL.h) * BASE,
  }
  const scaled = (pts: [number, number][]) =>
    pts.map(([x, y]) => [x * k, y * k] as [number, number])
  const inHotel = (pts: [number, number][]) =>
    pts.every(
      ([x, y]) => x > hotel.x0 && x < hotel.x1 && y > hotel.y0 && y < hotel.y1,
    )
  const GROW = 46
  const pieces: MaskPiece[] = []
  const add = (pts: [number, number][], fill: boolean, width: number) => {
    const p = scaled(pts)
    if (p.length && !inHotel(p)) pieces.push({ pts: p, fill, width })
  }
  for (const b of shapes.buildings)
    add(b.r ? rectToPolygon(b.r) : (b.p ?? []), true, GROW)
  for (const z of shapes.zones) add(z.p, true, GROW)
  for (const r of shapes.roads) add(r.p, false, GROW * 0.7 + r.w * k)
  for (const p of shapes.paths) add(p.p, false, GROW * 0.7 + p.w * k)
  return pieces
}
const MASK_BLUR = 34

// The soft shape the picture is cut to. It is made small (a quarter of the picture's pixels, it is
// only ever a blurry blob) and blurred by hand instead of with the canvas blur filter, which some
// browsers don't have and which is slow at full size. Made once per crop and kept
const MASK_RES = 0.25
const maskCache = new WeakMap<CampusShapes, Map<string, HTMLCanvasElement>>()

function blurLine(
  src: Float32Array,
  dst: Float32Array,
  n: number,
  stride: number,
  offset: number,
  r: number,
) {
  // a running sum, so the cost doesn't grow with the radius
  const size = 2 * r + 1
  let sum = 0
  for (let i = -r; i <= r; i++)
    if (i >= 0 && i < n) sum += src[offset + i * stride]
  for (let i = 0; i < n; i++) {
    dst[offset + i * stride] = sum / size
    const out = i - r
    const into = i + r + 1
    if (out >= 0) sum -= src[offset + out * stride]
    if (into < n) sum += src[offset + into * stride]
  }
}

function softMask(shapes: CampusShapes, crop: Rect) {
  const key = `${crop.x},${crop.y},${crop.w},${crop.h}`
  const perShapes =
    maskCache.get(shapes) ?? new Map<string, HTMLCanvasElement>()
  maskCache.set(shapes, perShapes)
  const cached = perShapes.get(key)
  if (cached) return cached

  const w = Math.max(1, Math.ceil(crop.w * MASK_RES))
  const h = Math.max(1, Math.ceil(crop.h * MASK_RES))
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) return canvas
  ctx.setTransform(
    MASK_RES,
    0,
    0,
    MASK_RES,
    -crop.x * MASK_RES,
    -crop.y * MASK_RES,
  )
  ctx.fillStyle = "white"
  ctx.strokeStyle = "white"
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  for (const piece of maskPieces(shapes)) {
    ctx.beginPath()
    piece.pts.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    if (piece.fill) {
      ctx.closePath()
      ctx.fill()
    }
    ctx.lineWidth = piece.width
    ctx.stroke()
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const image = ctx.getImageData(0, 0, w, h)
  let a: Float32Array = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) a[i] = image.data[i * 4 + 3] / 255
  let b: Float32Array = new Float32Array(w * h)
  const r = Math.max(1, Math.round(MASK_BLUR * MASK_RES))
  // three passes of a box blur are close to a gaussian one
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) blurLine(a, b, w, 1, y * w, r)
    for (let x = 0; x < w; x++) blurLine(b, a, h, w, x, r)
  }
  for (let i = 0; i < w * h; i++) {
    // a little contrast so the middle is fully solid and the edge still soft
    const v = Math.min(1, Math.max(0, (a[i] - 0.15) / 0.55))
    image.data[i * 4] = 255
    image.data[i * 4 + 1] = 255
    image.data[i * 4 + 2] = 255
    image.data[i * 4 + 3] = Math.round(v * 255)
  }
  ctx.putImageData(image, 0, 0)
  perShapes.set(key, canvas)
  return canvas
}

// -------------------------------------------------------------------- canvas renderer

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
  for (const { d, width } of iconParts(icon)) {
    ctx.lineWidth = width
    ctx.stroke(new Path2D(d))
  }
  ctx.restore()
}

// x,y is the tip of the pin, size its height
function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  fill: string,
  icon: IconNode[],
) {
  const k = size / 24
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = "rgba(0,0,0,0.32)"
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 0.28, size * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.translate(-12 * k, -22 * k)
  ctx.scale(k, k)
  ctx.fillStyle = fill
  ctx.fill(PIN_PATH)
  ctx.lineJoin = "round"
  ctx.lineWidth = 1.6
  ctx.strokeStyle = "rgba(255,255,255,0.95)"
  ctx.stroke(PIN_PATH)
  ctx.restore()
  if (icon.length) {
    ctx.save()
    ctx.translate(x, y - 10.8 * k)
    drawIcon(ctx, icon, size * 0.42, "white")
    ctx.restore()
  }
}

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, radius: number) {
  ctx.beginPath()
  ctx.roundRect(r.x, r.y, r.w, r.h, radius)
}

function drawCanvas(
  canvas: HTMLCanvasElement,
  scene: Scene,
  image: HTMLImageElement,
  logo: HTMLImageElement | null,
  mask: HTMLCanvasElement,
) {
  const { crop } = scene
  canvas.width = Math.round(crop.w * SCALE)
  canvas.height = Math.round(crop.h * SCALE)
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const base = [SCALE, 0, 0, SCALE, -crop.x * SCALE, -crop.y * SCALE] as const
  ctx.setTransform(...base)
  ctx.clearRect(crop.x, crop.y, crop.w, crop.h)

  if (scene.fade) {
    const layer = document.createElement("canvas")
    layer.width = canvas.width
    layer.height = canvas.height
    const l = layer.getContext("2d")
    if (l) {
      l.setTransform(...base)
      l.drawImage(image, 0, 0, BASE, BASE)
      l.setTransform(1, 0, 0, 1, 0, 0)
      // the soft shape is small and smooth, stretching it up keeps it smooth
      l.imageSmoothingEnabled = true
      l.imageSmoothingQuality = "high"
      l.globalCompositeOperation = "destination-in"
      l.drawImage(mask, 0, 0, canvas.width, canvas.height)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(layer, 0, 0)
      ctx.setTransform(...base)
    }
  } else ctx.drawImage(image, 0, 0, BASE, BASE)

  for (const pin of scene.pins)
    drawPin(ctx, pin.x, pin.y, pin.size, pin.fill, pin.icon)

  ctx.textBaseline = "middle"
  ctx.font = `600 ${LABEL_FONT}px sans-serif`
  for (const label of scene.labels) {
    ctx.lineJoin = "round"
    ctx.lineWidth = 2.6
    ctx.strokeStyle = "rgba(10,20,14,0.55)"
    ctx.strokeText(label.text, label.x, label.y)
    ctx.fillStyle = "white"
    ctx.fillText(label.text, label.x, label.y)
  }

  if (scene.legend) {
    ctx.font = "600 10.5px sans-serif"
    for (const row of scene.legend.rows) {
      drawPin(ctx, row.x, row.y + 13, 24, row.fill, row.icon)
      ctx.fillStyle = scene.ink
      ctx.textAlign = "left"
      ctx.fillText(row.text, row.x + 17, row.y + 2.2)
    }
  }

  // north arrow, top right
  ctx.save()
  ctx.translate(crop.x + crop.w - 34, crop.y + 34)
  ctx.fillStyle = "rgba(255,255,255,0.94)"
  ctx.beginPath()
  ctx.arc(0, 0, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#1f2a24"
  ctx.beginPath()
  ctx.moveTo(0, -13)
  ctx.lineTo(5.4, 4.8)
  ctx.lineTo(0, 1.2)
  ctx.lineTo(-5.4, 4.8)
  ctx.closePath()
  ctx.fill()
  ctx.font = "700 7px sans-serif"
  ctx.textAlign = "center"
  ctx.fillText("N", 0, 13)
  ctx.restore()

  if (scene.here) {
    const { x, y, angle } = scene.here
    const rad = ((angle - 90) * Math.PI) / 180
    ctx.save()
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 42)
    grad.addColorStop(0, "rgba(37,99,235,0.75)")
    grad.addColorStop(1, "rgba(37,99,235,0)")
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, 42, rad - 0.55, rad + 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, 6.6, 0, Math.PI * 2)
    ctx.fillStyle = "#2563eb"
    ctx.fill()
    ctx.lineWidth = 2.4
    ctx.strokeStyle = "white"
    ctx.stroke()
    ctx.font = "700 10.8px sans-serif"
    const text = "You are here"
    const tw = ctx.measureText(text).width
    roundRect(ctx, { x: x - tw / 2 - 7, y: y + 12, w: tw + 14, h: 19 }, 7)
    ctx.fillStyle = "#2563eb"
    ctx.fill()
    ctx.fillStyle = "white"
    ctx.textAlign = "center"
    ctx.fillText(text, x, y + 22)
    ctx.restore()
  }

  if (scene.footer) {
    const f = scene.footer
    ctx.textAlign = "left"
    ctx.fillStyle = scene.ink
    ctx.font = "700 9.5px sans-serif"
    ctx.fillText(f.partA, f.textX, f.y1)
    ctx.fillText(f.partB, f.partBX, f.y1)
    if (logo) {
      ctx.save()
      roundRect(ctx, f.logo, 3)
      ctx.clip()
      ctx.drawImage(logo, f.logo.x, f.logo.y, f.logo.w, f.logo.h)
      ctx.restore()
    }
    ctx.fillStyle = f.ink2
    ctx.font = "500 8px sans-serif"
    ctx.fillText(f.line2, f.textX, f.y2)
  }
}

// ---------------------------------------------------------------------- svg renderer

function svgIcon(icon: IconNode[], cx: number, cy: number, size: number) {
  const parts = iconParts(icon)
    .map(
      ({ d, width }) =>
        `<path d="${d}" fill="none" stroke="white" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("")
  return `<g transform="translate(${cx} ${cy}) scale(${size / 24}) translate(-12 -12)">${parts}</g>`
}

function svgPin(
  x: number,
  y: number,
  size: number,
  fill: string,
  icon: IconNode[],
) {
  const k = size / 24
  return (
    `<ellipse cx="${x}" cy="${y}" rx="${size * 0.28}" ry="${size * 0.1}" fill="rgba(0,0,0,0.32)"/>` +
    `<g transform="translate(${x - 12 * k} ${y - 22 * k}) scale(${k})"><path d="${PIN_D}" fill="${fill}" stroke="rgba(255,255,255,0.95)" stroke-width="1.6" stroke-linejoin="round"/></g>` +
    (icon.length ? svgIcon(icon, x, y - 10.8 * k, size * 0.42) : "")
  )
}

function buildSvg(
  scene: Scene,
  shapes: CampusShapes,
  tagByPinId: Record<string, string>,
  pieces: MaskPiece[],
  logoUrl: string | null,
) {
  const { crop } = scene
  const n = (v: number) => Math.round(v * 10) / 10
  const campus = buildCampusSvg(shapes, tagByPinId)
  // the drawing's own svg wrapper is dropped and its light colours are kept, whatever the viewer's
  // dark mode says
  const inner = campus
    .replace(/^<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/@media\s*\(prefers-color-scheme:dark\)\{:root\{[^}]*\}\}/, "")
  const maskShapes = pieces
    .map((piece) => {
      const d = `M${piece.pts.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}${piece.fill ? "Z" : ""}`
      return `<path d="${d}" fill="${piece.fill ? "white" : "none"}" stroke="white" stroke-width="${n(piece.width)}" stroke-linejoin="round" stroke-linecap="round"/>`
    })
    .join("")

  let overlay = ""
  for (const pin of scene.pins)
    overlay += svgPin(n(pin.x), n(pin.y), pin.size, pin.fill, pin.icon)
  for (const label of scene.labels)
    overlay += `<text x="${n(label.x)}" y="${n(label.y)}" dominant-baseline="central" font-family="sans-serif" font-weight="600" font-size="${LABEL_FONT}" fill="white" stroke="rgba(10,20,14,0.55)" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke">${esc(label.text)}</text>`
  if (scene.legend)
    for (const row of scene.legend.rows)
      overlay +=
        svgPin(n(row.x), n(row.y + 13), 24, row.fill, row.icon) +
        `<text x="${n(row.x + 17)}" y="${n(row.y + 2.2)}" dominant-baseline="central" font-family="sans-serif" font-weight="600" font-size="10.5" fill="${scene.ink}">${esc(row.text)}</text>`

  const nx = crop.x + crop.w - 34
  const ny = crop.y + 34
  overlay += `<circle cx="${nx}" cy="${ny}" r="18" fill="rgba(255,255,255,0.94)"/><path d="M${nx} ${ny - 13}L${nx + 5.4} ${ny + 4.8}L${nx} ${ny + 1.2}L${nx - 5.4} ${ny + 4.8}Z" fill="#1f2a24"/><text x="${nx}" y="${ny + 13}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" font-size="7" fill="#1f2a24">N</text>`

  if (scene.here) {
    const { x, y, angle } = scene.here
    const a0 = ((angle - 90) * Math.PI) / 180 - 0.55
    const a1 = a0 + 1.1
    overlay +=
      `<defs><radialGradient id="hereGlow" cx="${x}" cy="${y}" r="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#2563eb" stop-opacity="0.75"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></radialGradient></defs>` +
      `<path d="M${n(x)} ${n(y)}L${n(x + 42 * Math.cos(a0))} ${n(y + 42 * Math.sin(a0))}A42 42 0 0 1 ${n(x + 42 * Math.cos(a1))} ${n(y + 42 * Math.sin(a1))}Z" fill="url(#hereGlow)"/>` +
      `<circle cx="${n(x)}" cy="${n(y)}" r="6.6" fill="#2563eb" stroke="white" stroke-width="2.4"/>` +
      `<rect x="${n(x - 43)}" y="${n(y + 12)}" width="86" height="19" rx="7" fill="#2563eb"/><text x="${n(x)}" y="${n(y + 22)}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" font-size="10.8" fill="white">You are here</text>`
  }

  if (scene.footer) {
    const f = scene.footer
    const text = (
      x: number,
      y: number,
      weight: number,
      size: number,
      fill: string,
      body: string,
    ) =>
      `<text x="${n(x)}" y="${n(y)}" dominant-baseline="central" font-family="sans-serif" font-weight="${weight}" font-size="${size}" fill="${fill}">${esc(body)}</text>`
    overlay += text(f.textX, f.y1, 700, 9.5, scene.ink, f.partA)
    overlay += text(f.partBX, f.y1, 700, 9.5, scene.ink, f.partB)
    if (logoUrl)
      overlay += `<clipPath id="logoClip"><rect x="${n(f.logo.x)}" y="${n(f.logo.y)}" width="${f.logo.w}" height="${f.logo.h}" rx="3"/></clipPath><image href="${logoUrl}" x="${n(f.logo.x)}" y="${n(f.logo.y)}" width="${f.logo.w}" height="${f.logo.h}" clip-path="url(#logoClip)"/>`
    overlay += text(f.textX, f.y2, 500, 8, f.ink2, f.line2)
  }

  const mask = scene.fade
    ? `<defs><filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${MASK_BLUR}"/></filter><mask id="campus" maskUnits="userSpaceOnUse" x="0" y="0" width="${BASE}" height="${BASE}"><g filter="url(#soft)">${maskShapes}</g></mask></defs>`
    : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}" width="${crop.w * SCALE}" height="${crop.h * SCALE}">${mask}<g${scene.fade ? ' mask="url(#campus)"' : ""}>${inner}</g>${overlay}</svg>\n`
}

// ------------------------------------------------------------------------- the page

export function MapImageMaker({
  items,
  tags,
  shapes,
}: {
  items: MapItem[]
  tags: MapItemTag[]
  shapes: CampusShapes
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [style, setStyle] = useState<Style>("satellite")
  const [showPins, setShowPins] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const [showNames, setShowNames] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const [fade, setFade] = useState(true)
  const [darkText, setDarkText] = useState(true)
  const [here, setHere] = useState<Here | null>(null)
  const [pinId, setPinId] = useState("")
  const [svgUrl, setSvgUrl] = useState("")

  useEffect(() => {
    const img = new Image()
    img.src = "/auimap-1312.webp"
    img.onload = () => setImage(img)
    const icon = new Image()
    icon.src = "/icons/icon-192.png"
    icon.onload = () => setLogo(icon)
  }, [])

  const options = {
    items,
    tags,
    showPins,
    showDetails,
    showNames,
    showLegend,
    fade,
    darkText,
    here,
  }
  const optionsKey = JSON.stringify([
    style,
    showPins,
    showDetails,
    showNames,
    showLegend,
    fade,
    darkText,
    here,
  ])

  // the picture as the page shows it now, with the time it was made
  // biome-ignore lint/correctness/useExhaustiveDependencies: optionsKey stands for the options
  useEffect(() => {
    if (!image || !logo) return
    const scene = buildScene({ ...options, stamp: new Date() })
    const pieces = maskPieces(shapes)
    if (style === "satellite" && canvasRef.current)
      drawCanvas(
        canvasRef.current,
        scene,
        image,
        logo,
        softMask(shapes, scene.crop),
      )
    if (style === "vector") {
      const logoCanvas = document.createElement("canvas")
      logoCanvas.width = 96
      logoCanvas.height = 96
      logoCanvas.getContext("2d")?.drawImage(logo, 0, 0, 96, 96)
      const tagByPinId = Object.fromEntries(
        items.map((item) => [item.id, item.tag.id]),
      )
      const svg = buildSvg(
        scene,
        shapes,
        tagByPinId,
        pieces,
        logoCanvas.toDataURL("image/png"),
      )
      setSvgUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    }
  }, [image, logo, shapes, optionsKey])

  function placeFromClick(event: React.MouseEvent<HTMLElement>) {
    if (!image) return
    const box = event.currentTarget.getBoundingClientRect()
    const scene = buildScene({ ...options, stamp: new Date() })
    const { crop } = scene
    setPinId("")
    setHere((current) => ({
      x: crop.x + ((event.clientX - box.left) / box.width) * crop.w,
      y: crop.y + ((event.clientY - box.top) / box.height) * crop.h,
      angle: current?.angle ?? 0,
    }))
  }

  function placeAtPin(id: string) {
    setPinId(id)
    const item = items.find((candidate) => candidate.id === id)
    if (!item) return setHere(null)
    const [x, y] = latLongToPosition(item.latitude, item.longitude)
    setHere((current) => ({
      x: x * BASE,
      y: y * BASE,
      angle: current?.angle ?? 0,
    }))
  }

  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
  }

  // drawn again right now so the "last generated" time is the moment of the download
  function download() {
    if (!image || !logo) return
    const scene = buildScene({ ...options, stamp: new Date() })
    const pieces = maskPieces(shapes)
    if (style === "satellite" && canvasRef.current) {
      drawCanvas(
        canvasRef.current,
        scene,
        image,
        logo,
        softMask(shapes, scene.crop),
      )
      canvasRef.current.toBlob((blob) => blob && save(blob, "aui-map.png"))
      return
    }
    const logoCanvas = document.createElement("canvas")
    logoCanvas.width = 96
    logoCanvas.height = 96
    logoCanvas.getContext("2d")?.drawImage(logo, 0, 0, 96, 96)
    const svg = buildSvg(
      scene,
      shapes,
      Object.fromEntries(items.map((item) => [item.id, item.tag.id])),
      pieces,
      logoCanvas.toDataURL("image/png"),
    )
    save(new Blob([svg], { type: "image/svg+xml" }), "aui-map.svg")
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

  const checkerboard = {
    backgroundColor: "#e8ebe9",
    backgroundImage:
      "linear-gradient(45deg,#d3d8d5 25%,transparent 25%,transparent 75%,#d3d8d5 75%),linear-gradient(45deg,#d3d8d5 25%,transparent 25%,transparent 75%,#d3d8d5 75%)",
    backgroundSize: "24px 24px",
    backgroundPosition: "0 0,12px 12px",
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 p-4 lg:flex-row">
      <div className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl corner-squircle bg-foreground/5 p-1.5">
          {(
            [
              ["satellite", "Satellite (PNG)"],
              ["vector", "Drawing (SVG)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setStyle(id)}
              className={`rounded-xl corner-squircle px-2 py-2 text-sm font-medium ${
                style === id ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center justify-center gap-2 rounded-2xl corner-squircle bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          <Icon icon={Download01Icon} className="size-5" />
          Download {style === "vector" ? "SVG" : "PNG"}
        </button>
        <div className="flex flex-col gap-2 rounded-2xl corner-squircle bg-foreground/5 p-3">
          {toggle("Pins", showPins, setShowPins)}
          {toggle("Names", showNames, setShowNames)}
          {toggle("Small places (printers)", showDetails, setShowDetails)}
          {toggle("Legend", showLegend, setShowLegend)}
          {toggle("Fade out around the campus", fade, setFade)}
          {fade && toggle("Dark legend text", darkText, setDarkText)}
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
        {/* a checkerboard behind it, so the transparent parts show as transparent */}
        {style === "satellite" ? (
          <canvas
            ref={canvasRef}
            onClick={placeFromClick}
            className="mx-auto h-auto max-h-[85vh] w-auto max-w-full cursor-crosshair rounded-2xl"
            style={checkerboard}
          />
        ) : (
          // biome-ignore lint/performance/noImgElement: a generated picture, not a site asset
          <img
            src={svgUrl}
            alt="Map preview"
            onClick={placeFromClick}
            onKeyDown={() => {}}
            className="mx-auto h-auto max-h-[85vh] w-auto max-w-full cursor-crosshair rounded-2xl"
            style={checkerboard}
          />
        )}
      </div>
    </div>
  )
}
