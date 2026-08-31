"use client"

import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
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
  hoveredTagId: string | null
  onHoverTag: (tagId: string | null) => void
}

// active tags pull to the front so what's on is readable without scanning the whole set
export function TagPills({ tags, activeTagIds, onToggle, onHoverTag }: FilterProps) {
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
        <motion.div layout className="mx-1 h-4 w-px shrink-0 self-center bg-foreground/15" />
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

export function TagChipIcon({ tag, active }: { tag: MapItemTag; active: boolean }) {
  return (
    <Icon
      icon={tag.icon}
      className={cn("size-3.5", active && "drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]")}
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
      className={tagChipClassName(active, "transition-[opacity,filter] hover:opacity-80")}
    >
      <TagChipIcon {...{ tag, active }} />
      {tag.label}
    </motion.button>
  )
}

// the bar is deliberately not full-bleed: its two SquircleFuser patches live just outside its
// left and right edges, and they're what sells the bar as melting into the frame rather than
// sitting on top of it. Run it edge to edge and there's nowhere left for them to sit
const FILTER_BAR_SIDE_INSET = "6rem"
const FILTER_BAR_SCROLL_STEP_PX = 220
// the scrollable strip fades out on whichever side still has chips hidden past the edge, so a
// half-cut pill reads as "keep going" rather than as a clipping bug
const SCROLL_FADE = "3rem"

function scrollFadeMask(fadeLeft: boolean, fadeRight: boolean) {
  if (!fadeLeft && !fadeRight) return undefined
  const stops = [
    fadeLeft ? `transparent, black ${SCROLL_FADE}` : "black",
    fadeRight ? `black calc(100% - ${SCROLL_FADE}), transparent` : "black",
  ]
  return `linear-gradient(to right, ${stops[0]}, ${stops[1]})`
}

// wide dock for the map's roomy layout — replaced the decorative credit line that used to sit
// here, which said nothing the About dialog doesn't already say
export function MapFilterBar({
  reservedRight,
  ...props
}: FilterProps & { reservedRight: string }) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })

  // whether either arrow is warranted depends on the strip's scroll position AND on how much
  // room the bar was given, which changes when the detail panel opens or the window resizes —
  // so this watches the element itself rather than only listening for scroll events
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

  const scrollable = overflow.left || overflow.right

  const scrollByStep = (direction: 1 | -1) =>
    stripRef.current?.scrollBy({
      left: direction * FILTER_BAR_SCROLL_STEP_PX,
      behavior: "smooth",
    })

  return (
    <div
      className="map-filter-bar pointer-events-none absolute inset-0 transition-[right] duration-300 ease-out"
      style={{ right: reservedRight }}
    >
      <SquircleFuserContainer
        align="bottom-center"
        superClassName="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2"
        className="gap-2"
        style={{ maxWidth: `calc(100% - ${FILTER_BAR_SIDE_INSET})` }}
      >
        {/* permanently parked at the left edge so the row reads as "these are filters" without
            anyone having to work it out from the chips themselves */}
        <Icon
          icon={ICONS.filter}
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />

        <FilterScrollArrow
          direction={-1}
          shown={overflow.left}
          scrollable={scrollable}
          onClick={() => scrollByStep(-1)}
        />

        <div
          ref={stripRef}
          className={cn(
            "flex gap-1.5 overflow-x-auto scroll-smooth",
            HIDE_SCROLLBAR,
          )}
          style={{ maskImage: scrollFadeMask(overflow.left, overflow.right) }}
        >
          <TagPills {...props} />
        </div>

        <FilterScrollArrow
          direction={1}
          shown={overflow.right}
          scrollable={scrollable}
          onClick={() => scrollByStep(1)}
        />
      </SquircleFuserContainer>
    </div>
  )
}

// once the strip can scroll at all, both arrows hold their space and merely fade — otherwise
// reaching either end would shove every chip sideways. When nothing overflows they take no room
// at all, so a bar with a handful of tags doesn't carry two empty gutters
function FilterScrollArrow({
  direction,
  shown,
  scrollable,
  onClick,
}: {
  direction: 1 | -1
  shown: boolean
  scrollable: boolean
  onClick: () => void
}) {
  if (!scrollable) return null

  return (
    <IconButton
      size="sm"
      icon={direction === 1 ? ICONS.carouselNext : ICONS.carouselPrev}
      aria-label={direction === 1 ? "More categories" : "Previous categories"}
      aria-hidden={!shown}
      tabIndex={shown ? undefined : -1}
      className={cn(
        "shrink-0 transition-opacity",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      {...{ onClick }}
    />
  )
}
