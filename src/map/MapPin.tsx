"use client"

import {
  type MotionValue,
  motion,
  useMotionValueEvent,
  useTransform,
} from "motion/react"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shadcn/ui/tooltip"
import { triggerHaptic } from "@/utils/haptics"
import { latLongToPosition, positionToStyle } from "./geo"
import {
  type CrayonTuning,
  DEFAULT_CRAYON_TUNING,
  tagPinFillColor,
  tagPinOutlineColor,
} from "./tagColor"
import type { MapItem } from "./types"
import { DEFAULT_PIN_GROWTH_EXPONENT, pinCounterScale } from "./useMapPanZoom"

// Location02Icon's teardrop bottoms out at y=22 of its 24-unit viewBox, not at the very bottom of
// the box — so the pin is pulled up by that fraction rather than a flat -100%, and every scale on
// it pivots there too. Get this wrong and hovering or selecting a pin walks its point off the
// coordinate. /debug/pin measures it.
export const PIN_TIP_FRACTION = 22 / 24
const PIN_HEAD_FRACTION = 11 / 24

const PREVIEW_DIM_OPACITY = 0.2
// a small, deliberately subtle set rather than a continuous range — reads as a nudge, not a spin.
// only for hover and the tag-preview wiggle — selection uses SELECTED_TILT_DEG instead, which is
// meant to actually read as a tilt
const PIN_TILT_OPTIONS_DEG = [-1, 0, 0.5, 1, 1.5]
const SELECTED_TILT_DEG = 3
const UNDER_CONSTRUCTION_OPACITY = 0.6
// how far the invisible tap target extends past the icon's own edges, in the pin's own unscaled
// 32px box — sized so even a small-tag pin (0.8x) at the map's most zoomed-out still clears the
// 24px minimum touch target after every scale it goes through (tag size, zoom, selection)
const HIT_SLOP_PX = 8

export type PinSizeTuning = {
  // how much a pin shrinks as you zoom in — see useMapPanZoom's pinCounterScale
  growthExponent: number
  // the map-zoom past which every pin's own tooltip stays open on its own, no hover/tap needed —
  // a single cutoff, not a fade: it's either open or it isn't
  tooltipShowScale: number
  // pins solid at 100% read as an opaque wall once a cluster gets dense enough to overlap — a
  // little see-through keeps the buildings/paths underneath legible without the pin itself
  // reading as faded or broken
  pinOpacity: number
}

export const DEFAULT_PIN_SIZE_TUNING: PinSizeTuning = {
  growthExponent: DEFAULT_PIN_GROWTH_EXPONENT,
  tooltipShowScale: 4,
  pinOpacity: 0.95,
}

// stays the same for a given pin every time, so the tilt reads as each pin's own personality
// rather than jittering on every re-render — a real Math.random() would do the latter
function tiltForPin(id: string) {
  const hash = [...id].reduce(
    (seed, char) => (seed * 31 + char.charCodeAt(0)) | 0,
    7,
  )
  return PIN_TILT_OPTIONS_DEG[Math.abs(hash) % PIN_TILT_OPTIONS_DEG.length]
}

export function MapPin({
  item,
  selected,
  viewportScale,
  onSelect,
  previewing,
  matchesPreview,
  tuning = DEFAULT_CRAYON_TUNING,
  sizeTuning = DEFAULT_PIN_SIZE_TUNING,
}: {
  item: MapItem
  selected: boolean
  viewportScale: MotionValue<number>
  onSelect: () => void
  // hovering a tag in the filter list previews it: pins outside it fade out, pins inside it
  // wiggle a little so the preview doesn't just look like a fade someone forgot to finish
  previewing: boolean
  matchesPreview: boolean
  // only ever overridden by the dev-only TagColorPlayground — real visitors always get the default
  tuning?: CrayonTuning
  // only ever overridden by the dev-only PinTuningPlayground — real visitors always get the default
  sizeTuning?: PinSizeTuning
}) {
  const position = latLongToPosition(item.latitude, item.longitude)
  const counterScale = useTransform(viewportScale, (scale) =>
    pinCounterScale(scale, sizeTuning.growthExponent),
  )
  // past this zoom, every pin's tooltip stays open on its own — no hover/tap needed to read a
  // name once you're zoomed in enough. Real state, not a motion value: Radix's `open` prop needs
  // a plain boolean, and this only actually changes on the rare frame that crosses the threshold
  const [zoomedPastTooltipThreshold, setZoomedPastTooltipThreshold] = useState(
    () => viewportScale.get() > sizeTuning.tooltipShowScale,
  )
  useMotionValueEvent(viewportScale, "change", (scale) => {
    const next = scale > sizeTuning.tooltipShowScale
    setZoomedPastTooltipThreshold((current) =>
      current === next ? current : next,
    )
  })
  // hover/focus still drives it normally below the threshold; forcing `open` past it doesn't
  // stop Radix from calling this on mouse leave, so this stays the last hover-only intent and
  // the OR below lets the zoom threshold win over it whenever it applies
  const [hoverOpen, setHoverOpen] = useState(false)
  const fill = tagPinFillColor(item.tag.color, tuning)
  const outline = tagPinOutlineColor(item.tag.color)
  const tilt = tiltForPin(item.id)
  // browser's default focus rectangle looks out of place on a round pin — keyboard nav gets the
  // same colored glow a selected pin gets instead. :focus-visible's own heuristic already tells
  // mouse/touch activation apart from keyboard, so this never fires from a click or a tap
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const showGlow = selected || keyboardFocused
  // same left/right split as the personality tilt, just at a magnitude that actually reads as
  // a tilt rather than a nudge — each pin leans the same way whether it's picking its hover
  // nudge or its selected tilt, so the two never fight each other mid-transition
  const selectedTilt = tilt >= 0 ? SELECTED_TILT_DEG : -SELECTED_TILT_DEG
  const restingTilt = selected
    ? selectedTilt
    : previewing && matchesPreview
      ? tilt
      : 0
  const sizeScale = item.tag.sizeScale

  return (
    <Tooltip
      open={zoomedPastTooltipThreshold || hoverOpen}
      onOpenChange={setHoverOpen}
    >
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
          {/* a plain radial-gradient, not a filter — filters are what made per-pin shadows janky
              before (see useMapPanZoom's isMoving), and a filter drop-shadow has to be stripped
              during that same movement, which just made the shadow flicker in and out while
              dragging. This is a background, not a filter, so it never needs to be suppressed —
              it's what gives the pin contrast against busy satellite imagery even mid-drag. Sits
              on this div rather than the button below so it only rides the map's zoom
              counter-scale, not the hover/tap/selection bump */}
          <span
            aria-hidden
            className="pointer-events-none absolute h-3 w-6 rounded-full"
            style={{
              left: "50%",
              top: `${PIN_TIP_FRACTION * 100}%`,
              transform: `translate(-50%, -50%) scale(${sizeScale})`,
              background: `radial-gradient(closest-side, rgba(0,0,0,${selected ? 0.65 : 0.55}), rgba(0,0,0,0) 75%)`,
            }}
          />
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
            onFocus={(e) => {
              if (e.currentTarget.matches(":focus-visible"))
                setKeyboardFocused(true)
            }}
            onBlur={() => setKeyboardFocused(false)}
            aria-label={item.title}
            className="pin-filter relative block cursor-pointer touch-none outline-none"
            animate={{
              scale: (selected ? 1.3 : 1) * sizeScale,
              rotate: restingTilt,
            }}
            whileHover={{
              scale: (selected ? 1.45 : 1.25) * sizeScale,
              rotate: selected ? selectedTilt : tilt,
            }}
            whileTap={{ scale: 0.9 * sizeScale }}
            style={{ originX: 0.5, originY: PIN_TIP_FRACTION }}
          >
            {/* invisible — expands the tap target without changing anything visible. Grows/shrinks
                with the same scale as everything else here, so it stays centered and proportional
                through every zoom level and tag size rather than needing its own position math */}
            <span
              aria-hidden
              className="absolute"
              style={{ inset: -HIT_SLOP_PX }}
            />
            {showGlow && (
              <>
                {/* a steady glow so the selection/focus reads even between the ping's pulses, not
                    just during them */}
                <span
                  className="absolute left-1/2 size-5 -translate-1/2 rounded-full opacity-70 blur-[3px]"
                  style={{
                    backgroundColor: fill,
                    top: `${PIN_HEAD_FRACTION * 100}%`,
                  }}
                />
                {/* the pulse itself stays selection-only — replaying it on every tab stop would be
                    distracting rather than a helpful indicator */}
                {selected && (
                  <span
                    className="absolute left-1/2 size-5 -translate-1/2 animate-ping rounded-full opacity-70"
                    style={{
                      backgroundColor: fill,
                      top: `${PIN_HEAD_FRACTION * 100}%`,
                    }}
                  />
                )}
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
                filter: showGlow ? `drop-shadow(0 0 6px ${fill})` : undefined,
                opacity: item.underConstruction
                  ? UNDER_CONSTRUCTION_OPACITY
                  : sizeTuning.pinOpacity,
              }}
              className="pin-filter relative block size-8"
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
