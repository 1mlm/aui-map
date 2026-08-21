"use client"

import { type MotionValue, motion, useTransform } from "motion/react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import { triggerHaptic } from "@/utils/haptics"
import { latLongToPosition, positionToStyle } from "./geo"
import { tagPinFillColor, tagPinOutlineColor } from "./tagColor"
import type { MapItem } from "./types"
import { pinCounterScale } from "./useMapPanZoom"

// Location02Icon's teardrop bottoms out at y=22 of its 24-unit viewBox, not at the very bottom of
// the box — so the pin is pulled up by that fraction rather than a flat -100%, and every scale on
// it pivots there too. Get this wrong and hovering or selecting a pin walks its point off the
// coordinate. /debug/pin measures it.
export const PIN_TIP_FRACTION = 22 / 24
const PIN_HEAD_FRACTION = 11 / 24

const INNER_SHADOW_FILTER_ID = "pin-inner-shadow"
const PREVIEW_DIM_OPACITY = 0.2
// a small, deliberately subtle set rather than a continuous range — reads as a nudge, not a spin
const PIN_TILT_OPTIONS_DEG = [-1, 0, 0.5, 1, 1.5]

// stays the same for a given pin every time, so the tilt reads as each pin's own personality
// rather than jittering on every re-render — a real Math.random() would do the latter
function tiltForPin(id: string) {
  const hash = [...id].reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) | 0,
    7,
  )
  return PIN_TILT_OPTIONS_DEG[Math.abs(hash) % PIN_TILT_OPTIONS_DEG.length]
}

// box-shadow (so tailwind's inset-shadow-*) paints the element's rectangle and would draw a square
// around the teardrop, and css filters have no inset drop-shadow — an svg filter is the only thing
// that reads the drawn shape's alpha. Rendered once by MapCanvas, referenced by every pin.
export function PinInnerShadowFilter() {
  return (
    <svg aria-hidden className="absolute size-0">
      <title>Pin inner shadow filter</title>
      <filter
        id={INNER_SHADOW_FILTER_ID}
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feOffset dy="1.2" />
        <feGaussianBlur stdDeviation="0.9" result="blurred" />
        {/* everything the blurred copy leaves uncovered inside the pin is where light wouldn't reach */}
        <feComposite
          operator="out"
          in="SourceGraphic"
          in2="blurred"
          result="recess"
        />
        <feFlood floodColor="black" floodOpacity="0.45" />
        <feComposite operator="in" in2="recess" />
        <feComposite operator="over" in2="SourceGraphic" />
      </filter>
    </svg>
  )
}

export function MapPin({
  item,
  selected,
  viewportScale,
  onSelect,
  previewing,
  matchesPreview,
}: {
  item: MapItem
  selected: boolean
  viewportScale: MotionValue<number>
  onSelect: () => void
  // hovering a tag in the filter list previews it: pins outside it fade out, pins inside it
  // wiggle a little so the preview doesn't just look like a fade someone forgot to finish
  previewing: boolean
  matchesPreview: boolean
}) {
  const position = latLongToPosition(item.latitude, item.longitude)
  const counterScale = useTransform(viewportScale, pinCounterScale)
  const fill = tagPinFillColor(item.tag.color)
  const outline = tagPinOutlineColor(item.tag.color)
  const tilt = tiltForPin(item.id)
  const restingTilt = selected || (previewing && matchesPreview) ? tilt : 0
  const sizeScale = item.tag.sizeScale

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Two nested scales on purpose: the outer one is owned by the map's zoom motion value,
            the inner by hover/tap/selection. Sharing one element would let whileHover overwrite
            the counter-scale and leave the pin the wrong size once the pointer leaves. */}
        <motion.div
          style={{
            ...positionToStyle(position),
            x: "-50%",
            y: `${-PIN_TIP_FRACTION * 100}%`,
            scale: counterScale,
            originX: 0.5,
            originY: PIN_TIP_FRACTION,
            // a selected pin always wins regardless of size; otherwise a smaller-scale tag (food,
            // sports, auditoriums...) stacks in front of the normal-size buildings it sits next to,
            // so it doesn't get lost underneath one
            zIndex: selected ? 1000 : Math.round((2 - sizeScale) * 10),
          }}
          animate={{
            opacity: previewing && !matchesPreview ? PREVIEW_DIM_OPACITY : 1,
          }}
          className="absolute"
        >
          <motion.button
            type="button"
            onClick={(e) => {
              // ctrl/cmd + click is the canvas's copy-this-coordinate gesture. A pin standing in
              // the way shouldn't open its panel, and mustn't swallow the click either
              if (e.ctrlKey || e.metaKey) return
              e.stopPropagation()
              triggerHaptic()
              onSelect()
            }}
            className="pin-filter block cursor-pointer touch-none"
            animate={{
              scale: (selected ? 1.3 : 1) * sizeScale,
              rotate: restingTilt,
            }}
            whileHover={{
              scale: (selected ? 1.45 : 1.25) * sizeScale,
              rotate: tilt,
            }}
            whileTap={{ scale: 0.9 * sizeScale }}
            style={{ originX: 0.5, originY: PIN_TIP_FRACTION }}
          >
            {selected && (
              <>
                {/* a steady glow so the selection reads even between the ping's pulses, not just
                    during them */}
                <span
                  className="absolute left-1/2 size-5 -translate-1/2 rounded-full opacity-70 blur-[3px]"
                  style={{
                    backgroundColor: fill,
                    top: `${PIN_HEAD_FRACTION * 100}%`,
                  }}
                />
                <span
                  className="absolute left-1/2 size-5 -translate-1/2 animate-ping rounded-full opacity-70"
                  style={{
                    backgroundColor: fill,
                    top: `${PIN_HEAD_FRACTION * 100}%`,
                  }}
                />
              </>
            )}
            <Icon
              icon={ICONS.pin}
              fill={fill}
              strokeWidth={1.8}
              style={{
                // the stroke follows currentColor, and color-mix() only parses reliably as a css
                // property — as hugeicons' `color` svg attribute it can silently fall back
                color: outline,
                filter: selected ? `drop-shadow(0 0 6px ${fill})` : undefined,
              }}
              className="pin-filter relative block size-7"
            />
          </motion.button>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="font-semibold">
        {item.shortestName}
      </TooltipContent>
    </Tooltip>
  )
}
