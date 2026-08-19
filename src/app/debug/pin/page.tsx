"use client"

import { useMotionValue } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { latLongToPosition, parseCoordinates, positionToStyle } from "@/map/geo"
import { MapPin } from "@/map/MapPin"
import { MAP_ITEMS, MAP_TAGS } from "@/map/data"
import type { MapItem } from "@/map/types"

// throwaway route for checking that a pin's drawn point actually sits on its coordinate. Delete
// it whenever. The two entries below are the only coordinates that were surveyed by hand, so
// they're the ones worth trusting as ground truth.
const SURVEYED = [
  { title: "AUI Sports Field", coord: "33.540742, -5.108640", tag: "sports" },
  { title: "AUD 17", coord: "33.537595, -5.106582", tag: "academic" },
] as const

const items: MapItem[] = SURVEYED.map(({ title, coord, tag }, index) => ({
  id: `${index}`,
  title,
  aliases: [],
  shortestName: title,
  mapsUrl: null,
  hours: null,
  ramadanHours: null,
  phone: null,
  email: null,
  links: [],
  tag: MAP_TAGS[tag],
  attachments: [],
  ...parseCoordinates(coord),
}))

// the pin's point in screen pixels, read off the drawn path rather than assumed from the box it
// sits in — getScreenCTM folds in the zoom, the counter-scale and any hover scale at once
function measureDrawnTip(pin: Element) {
  const path = pin.querySelector("path")
  const svg = pin.querySelector("svg")
  const matrix = path?.getScreenCTM()
  if (!path || !svg || !matrix) return null

  const box = path.getBBox()
  const point = Object.assign(svg.createSVGPoint(), { x: box.x + box.width / 2, y: box.y + box.height })
  return point.matrixTransform(matrix)
}

export default function PinDebugPage() {
  const [scale, setScale] = useState(1.45)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const viewportScale = useMotionValue(scale)
  const boxRef = useRef<HTMLDivElement>(null)

  viewportScale.set(scale)

  useEffect(() => {
    const measure = () => {
      setErrors(
        items.map((item) => {
          const target = boxRef.current?.querySelector(`[data-target='${item.id}']`)
          const pin = boxRef.current?.querySelector(`[data-pin='${item.id}']`)
          const tip = pin && measureDrawnTip(pin)
          if (!target || !tip) return `${item.title}: not rendered`

          const aim = target.getBoundingClientRect()
          const dx = tip.x - (aim.left + aim.width / 2)
          const dy = tip.y - (aim.top + aim.height / 2)
          return `${item.title}: dx ${dx.toFixed(2)}px, dy ${dy.toFixed(2)}px`
        }),
      )
    }
    const frame = requestAnimationFrame(measure)
    const interval = setInterval(measure, 250)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-neutral-950 p-6 text-sm text-white">
      <label className="flex items-center gap-3">
        map scale {scale.toFixed(2)}
        <input
          type="range"
          min={0.9}
          max={5}
          step={0.05}
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="w-96"
        />
      </label>
      <p className="opacity-70">
        the magenta crosshair is the coordinate. hover a pin, select it, drag the slider — the
        numbers below must stay at zero through all of it.
      </p>
      <ul className="font-mono">
        {errors.map((line) => (
          <li key={line.split(":")[0]}>{line}</li>
        ))}
      </ul>

      <div className="relative h-[600px] w-[600px] overflow-hidden outline outline-white/20">
        <div
          className="absolute inset-0 origin-center"
          style={{ transform: `scale(${scale})` }}
          ref={boxRef}
        >
          <Image src="/auimap.webp" alt="" fill unoptimized className="opacity-60" />
          {MAP_ITEMS.map((item) => (
            <span
              key={item.id}
              className="pointer-events-none absolute -translate-1/2 text-[5px] whitespace-nowrap text-lime-300"
              style={positionToStyle(latLongToPosition(item.latitude, item.longitude))}
            >
              ×{item.id}
            </span>
          ))}
          {items.map((item) => (
            <div key={item.id}>
              <Crosshair id={item.id} latitude={item.latitude} longitude={item.longitude} />
              <div data-pin={item.id}>
                <MapPin
                  selected={item.id === selectedId}
                  onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
                  previewing={false}
                  matchesPreview={false}
                  {...{ item, viewportScale }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Crosshair({ id, latitude, longitude }: { id: string; latitude: number; longitude: number }) {
  return (
    <div
      data-target={id}
      className="pointer-events-none absolute size-px -translate-1/2 outline outline-fuchsia-500 outline-offset-[3px]"
      style={positionToStyle(latLongToPosition(latitude, longitude))}
    />
  )
}
