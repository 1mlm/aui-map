"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { HIDE_SCROLLBAR } from "@/utils/styles"
import { tagColorStyle } from "./tagColor"
import type { MapItemTag } from "./types"

export type FilterProps = {
  tags: MapItemTag[]
  activeTagIds: Set<string>
  onToggle: (tagId: string) => void
  onClearAll: () => void
  hoveredTagId: string | null
  onHoverTag: (tagId: string | null) => void
}

// active tags pull to the front so what's on is readable without scanning the whole set
export function TagPills({
  tags,
  activeTagIds,
  onToggle,
  onHoverTag,
}: FilterProps) {
  const activeTags = tags.filter((tag) => activeTagIds.has(tag.id))
  const inactiveTags = tags.filter((tag) => !activeTagIds.has(tag.id))

  return (
    <>
      {activeTags.map((tag) => (
        <TagPill
          key={tag.id}
          active
          onClick={() => onToggle(tag.id)}
          onHover={(hovering) => onHoverTag(hovering ? tag.id : null)}
          {...{ tag }}
        />
      ))}
      {activeTags.length > 0 && inactiveTags.length > 0 && (
        <motion.div
          layout
          className="mx-1 h-4 w-px shrink-0 self-center bg-foreground/15"
        />
      )}
      {inactiveTags.map((tag) => (
        <TagPill
          key={tag.id}
          active={false}
          onClick={() => onToggle(tag.id)}
          onHover={(hovering) => onHoverTag(hovering ? tag.id : null)}
          {...{ tag }}
        />
      ))}
    </>
  )
}

// shared with the detail panel's tag badge, so a tag reads identically wherever it shows up
export function tagChipClassName(active: boolean, className?: string) {
  return cn(
    "flex shrink-0 items-center gap-1.5 rounded-full corner-squircle px-3 py-1.5 text-xs font-medium whitespace-nowrap",
    active ? "text-shadow-[0_2px_3px_rgba(0,0,0,0.4)]" : "grayscale-[75%]",
    className,
  )
}

export function TagChipIcon({
  tag,
  active,
}: {
  tag: MapItemTag
  active: boolean
}) {
  return (
    <Icon
      icon={tag.icon}
      className={cn(
        "size-3.5",
        active && "drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]",
      )}
    />
  )
}

function TagPill({
  tag,
  active,
  onClick,
  onHover,
}: {
  tag: MapItemTag
  active: boolean
  onClick: () => void
  onHover: (hovering: boolean) => void
}) {
  return (
    <motion.button
      layout
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      type="button"
      onClick={() => {
        triggerHaptic()
        onClick()
      }}
      onHoverStart={() => onHover(true)}
      onHoverEnd={() => onHover(false)}
      data-active={active}
      style={tagColorStyle(tag.color, active)}
      className={tagChipClassName(
        active,
        "transition-[opacity,filter] hover:opacity-80",
      )}
    >
      <TagChipIcon {...{ tag, active }} />
      {tag.label}
      {active && <Icon icon={ICONS.close} className="size-3.5" />}
    </motion.button>
  )
}

// the full-layout bar is deliberately not full-bleed: its two SquircleFuser patches live just
// outside its left and right edges, and they're what sells the bar as melting into the frame
// rather than sitting on top of it. Run it edge to edge and there's nowhere left for them to sit.
// The compact bar skips this entirely -- a phone screen doesn't have the width to spare
const FILTER_BAR_SIDE_INSET = "6rem"
// the scrollable strip fades out on whichever side still has chips hidden past the edge, so a
// half-cut pill reads as "keep going" rather than as a clipping bug. This is the whole overflow
// affordance — scroll arrows were tried and cut: they had to hold their space to avoid shoving
// the chips sideways at each end, which left two dead gutters and made the bar read as spaced out
const SCROLL_FADE = "3rem"

function scrollFadeMask(fadeLeft: boolean, fadeRight: boolean) {
  if (!fadeLeft && !fadeRight) return undefined
  const stops = [
    fadeLeft ? `transparent, black ${SCROLL_FADE}` : "black",
    fadeRight ? `black calc(100% - ${SCROLL_FADE}), transparent` : "black",
  ]
  return `linear-gradient(to right, ${stops[0]}, ${stops[1]})`
}

// shared by both bar layouts: which side of the horizontally-scrolling strip is cut off depends
// on its scroll position AND on how much room it was given, which changes when the detail panel
// opens or the window resizes — so this watches the element itself rather than only scroll events
function useScrollFadeMask() {
  const stripRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })

  useEffect(() => {
    const strip = stripRef.current
    if (!strip) return

    const sync = () =>
      setOverflow({
        left: strip.scrollLeft > 1,
        right: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      })

    sync()
    strip.addEventListener("scroll", sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(strip)
    return () => {
      strip.removeEventListener("scroll", sync)
      observer.disconnect()
    }
  }, [])

  return { stripRef, maskImage: scrollFadeMask(overflow.left, overflow.right) }
}

// mobile: a floating inset pill over the map itself rather than a full-width strip below it --
// half-transparent so there's still map showing through behind the chips, matching the locate
// button's own floating-over-the-map treatment instead of reading as a separate docked toolbar
function CompactFilterBar(props: FilterProps) {
  const { stripRef, maskImage } = useScrollFadeMask()
  const { activeTagIds, onClearAll } = props

  return (
    <div className="map-filter-bar-compact pointer-events-auto absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full corner-superellipse/1.2 bg-background/70 px-3.5 py-2.5 shadow-lg drop-shadow-black/40 backdrop-blur-md">
      {/* sits outside the scrolling strip below it -- inside, it'd scroll away with the chips it's
          meant to always be reachable from */}
      {activeTagIds.size > 0 && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic()
            onClearAll()
          }}
          className="absolute -top-3 left-2 flex shrink-0 items-center gap-1 rounded-full corner-superellipse/1.2 bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-md"
        >
          <Icon icon={ICONS.reopen} className="size-3" />
          Clear filter
        </button>
      )}
      <Icon
        icon={ICONS.filter}
        aria-hidden
        className="size-4 shrink-0 text-muted-foreground"
      />
      <div
        ref={stripRef}
        className={cn(
          "flex gap-1.5 overflow-x-auto scroll-smooth",
          HIDE_SCROLLBAR,
        )}
        style={{ maskImage }}
      >
        <TagPills {...props} />
      </div>
    </div>
  )
}

// wide dock for the map's roomy layout — replaced the decorative credit line that used to sit
// here, which said nothing the About dialog doesn't already say
function FullFilterBar({
  reservedRight,
  ...props
}: FilterProps & { reservedRight: string }) {
  const { stripRef, maskImage } = useScrollFadeMask()

  return (
    <div
      className="map-filter-bar-full pointer-events-none absolute inset-0 transition-[right] duration-300 ease-out"
      style={{ right: reservedRight }}
    >
      <SquircleFuserContainer
        align="bottom-center"
        superClassName="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2"
        className="gap-3"
        style={{ maxWidth: `calc(100% - ${FILTER_BAR_SIDE_INSET})` }}
      >
        <Icon
          icon={ICONS.filter}
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />

        <div
          ref={stripRef}
          className={cn(
            "flex gap-1.5 overflow-x-auto scroll-smooth",
            HIDE_SCROLLBAR,
          )}
          style={{ maskImage }}
        >
          <TagPills {...props} />
        </div>
      </SquircleFuserContainer>
    </div>
  )
}

// both layouts render unconditionally; which one is actually visible is decided by a CSS
// container query (globals.css's .map-filter-bar-compact / .map-filter-bar-full rules), matching
// how MapControls splits into its own compact/full pair
export function MapFilterBar(props: FilterProps & { reservedRight: string }) {
  return (
    <>
      <CompactFilterBar {...props} />
      <FullFilterBar {...props} />
    </>
  )
}
