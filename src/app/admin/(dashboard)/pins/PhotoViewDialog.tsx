"use client"

import Image from "next/image"
import { useEffect, useRef, useState, useTransition } from "react"
import { FormError } from "@/components/FormError"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { latLongToPosition, positionToLatLong } from "@/map/geo"
import { Button } from "@/shadcn/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog"
import { cloudinaryThumbnail } from "@/utils/cloudinaryUrl"
import { extractErrorMessage } from "@/utils/error"
import type { PhotoView } from "./actions"

const SIZE = 1312
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

type Origin = { latitude: number; longitude: number }

const toPx = ({ latitude, longitude }: Origin) => {
  const [x, y] = latLongToPosition(latitude, longitude)
  return { x: x * SIZE, y: y * SIZE }
}

// says where a photo was taken and which way the camera faced: click the map to put the camera
// down, drag the round handle (or tap a compass letter) to turn it. All of it is optional
export function PhotoViewDialog({
  open,
  onOpenChange,
  imageUrl,
  initial,
  origin,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  imageUrl: string
  initial: PhotoView | null
  // the pin the photo belongs to, where the map starts and what "at the pin" means
  origin: Origin
  onSave: (view: PhotoView | null) => Promise<void>
}) {
  const [camera, setCamera] = useState<{ x: number; y: number } | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [zoom, setZoom] = useState(130)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef<"camera" | "heading" | null>(null)

  useEffect(() => {
    if (!open) return
    setCamera(initial ? toPx(initial) : null)
    setHeading(initial?.heading ?? null)
    setError(null)
  }, [open, initial])

  const pin = toPx(origin)
  const center = camera ?? pin
  const view = { x: center.x - zoom / 2, y: center.y - zoom / 2, s: zoom }
  const unit = zoom / 300

  function toSvg(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const p = point.matrixTransform(ctm.inverse())
    return { x: p.x, y: p.y }
  }

  function aim(at: { x: number; y: number }) {
    if (!camera) return
    const angle =
      (Math.atan2(at.x - camera.x, -(at.y - camera.y)) * 180) / Math.PI
    setHeading(Math.round((angle + 360) % 360))
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    const at = toSvg(event)
    if (!at) return
    ;(event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId)
    if (dragging.current) return
    // a click on empty map puts the camera there
    setCamera(at)
  }
  function onPointerMove(event: React.PointerEvent) {
    const at = toSvg(event)
    if (!at || !dragging.current) return
    if (dragging.current === "camera") setCamera(at)
    else aim(at)
  }
  function onPointerUp() {
    dragging.current = null
  }

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        if (!camera) await onSave(null)
        else {
          const { latitude, longitude } = positionToLatLong([
            camera.x / SIZE,
            camera.y / SIZE,
          ])
          await onSave({
            latitude: Number(latitude.toFixed(7)),
            longitude: Number(longitude.toFixed(7)),
            heading,
          })
        }
        onOpenChange(false)
      } catch (err) {
        setError(extractErrorMessage(err, "Couldn't save."))
      }
    })
  }

  const rad = ((heading ?? 0) - 90) * (Math.PI / 180)
  const reach = 46 * unit * 1.6
  const tip = camera && {
    x: camera.x + Math.cos(rad) * reach,
    y: camera.y + Math.sin(rad) * reach,
  }

  return (
    <Dialog {...{ open, onOpenChange }}>
      <DialogContent className="corner-squircle sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon={ICONS.place} />
            Where was it taken
          </DialogTitle>
          <DialogDescription>
            Click the map to put the camera down, then turn it. Optional.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl corner-squircle bg-muted">
            <Image
              src={cloudinaryThumbnail(imageUrl, 160)}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col justify-center gap-1.5">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCamera(pin)}
                className="inline-flex items-center gap-1.5 rounded-xl corner-squircle bg-foreground/10 px-2.5 py-1.5 text-sm hover:bg-foreground/15"
              >
                <Icon icon={ICONS.place} className="size-4" />
                At the pin
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(40, z / 1.6))}
                aria-label="Zoom in"
                className="grid size-8 place-items-center rounded-xl corner-squircle bg-foreground/10 text-lg hover:bg-foreground/15"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(600, z * 1.6))}
                aria-label="Zoom out"
                className="grid size-8 place-items-center rounded-xl corner-squircle bg-foreground/10 text-lg hover:bg-foreground/15"
              >
                -
              </button>
            </div>
            <span className="text-muted-foreground text-xs">
              {camera
                ? heading === null
                  ? "Position set. Add a direction if you know it"
                  : `Facing ${heading} degrees`
                : "No position yet"}
            </span>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`}
          className="aspect-square w-full touch-none select-none rounded-2xl bg-neutral-900"
          style={{ cursor: "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <title>Where the photo was taken</title>
          <image
            href="/auimap-1312.avif"
            width={SIZE}
            height={SIZE}
            pointerEvents="none"
          />
          {/* the pin this photo belongs to, for reference */}
          <circle
            cx={pin.x}
            cy={pin.y}
            r={5 * unit * 1.6}
            fill="#fff"
            fillOpacity={0.9}
            stroke="#16231b"
            strokeWidth={1.2 * unit * 1.6}
            pointerEvents="none"
          />
          {camera && heading !== null && (
            <path
              d={`M${camera.x} ${camera.y}L${camera.x + Math.cos(rad - 0.5) * reach} ${camera.y + Math.sin(rad - 0.5) * reach}A${reach} ${reach} 0 0 1 ${camera.x + Math.cos(rad + 0.5) * reach} ${camera.y + Math.sin(rad + 0.5) * reach}Z`}
              fill="#2563eb"
              fillOpacity={0.45}
              pointerEvents="none"
            />
          )}
          {camera && (
            <g>
              <circle
                cx={camera.x}
                cy={camera.y}
                r={7 * unit * 1.6}
                fill="#2563eb"
                stroke="#fff"
                strokeWidth={2.4 * unit * 1.6}
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  ;(svgRef.current as SVGSVGElement).setPointerCapture(
                    e.pointerId,
                  )
                  dragging.current = "camera"
                }}
              />
              {tip && (
                <circle
                  cx={tip.x}
                  cy={tip.y}
                  r={6 * unit * 1.6}
                  fill="#fff"
                  stroke="#2563eb"
                  strokeWidth={2.2 * unit * 1.6}
                  style={{ cursor: "grab" }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    ;(svgRef.current as SVGSVGElement).setPointerCapture(
                      e.pointerId,
                    )
                    if (heading === null) setHeading(0)
                    dragging.current = "heading"
                  }}
                />
              )}
            </g>
          )}
        </svg>

        {camera && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-8 gap-1">
              {COMPASS.map(([label, angle]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setHeading(angle)}
                  className={`rounded-lg corner-squircle py-1 text-xs font-semibold ${
                    heading === angle
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
              value={heading ?? 0}
              onChange={(e) => setHeading(Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => setHeading(null)}
              className="self-start text-muted-foreground text-xs underline"
            >
              No direction
            </button>
          </div>
        )}

        <FormError>{error}</FormError>
        <div className="flex gap-2">
          {(camera || initial) && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full corner-squircle"
              disabled={pending}
              onClick={() => {
                setCamera(null)
                setHeading(null)
              }}
            >
              <Icon icon={ICONS.delete} />
              Clear
            </Button>
          )}
          <Button
            type="button"
            className="flex-1 rounded-full corner-squircle"
            disabled={pending}
            onClick={save}
          >
            <Icon icon={ICONS.save} />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
