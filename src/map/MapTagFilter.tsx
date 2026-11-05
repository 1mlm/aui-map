"use client"

import { m } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { BottomDrawer } from "@/components/BottomDrawer"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { Checkbox } from "@/shadcn/ui/checkbox"
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
        <m.div
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
    <m.button
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
    </m.button>
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
  return <FullFilterBar {...props} />
}

// phones: a drawer of checkboxes behind the filter button. Everything is ticked by default.
// Unticking "Everything" clears the map so one or two categories can be picked on their own.
// It doesn't block the map, so it can stay open while you look around
export function FilterDrawer({
  open,
  onOpenChange,
  tags,
  shownTagIds,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tags: MapItemTag[]
  // null = everything
  shownTagIds: Set<string> | null
  onChange: (shown: Set<string> | null) => void
}) {
  const everything = shownTagIds === null
  const isShown = (tagId: string) => everything || shownTagIds.has(tagId)

  function toggle(tagId: string) {
    const next = new Set(everything ? tags.map((tag) => tag.id) : shownTagIds)
    if (next.has(tagId)) next.delete(tagId)
    else next.add(tagId)
    onChange(next.size === tags.length ? null : next)
  }

  return (
    <BottomDrawer
      modal={false}
      title="Show on the map"
      {...{ open, onOpenChange }}
    >
      <div className="flex flex-col">
        <FilterRow
          checked={everything}
          onToggle={() => onChange(everything ? new Set() : null)}
          label="Everything"
        />
        <span className="my-1 h-px bg-border" />
        {/* two columns, so the drawer stays short and most of the map is still in view */}
        <div className="grid grid-cols-2 gap-x-2">
          {tags.map((tag) => (
            <FilterRow
              key={tag.id}
              checked={isShown(tag.id)}
              onToggle={() => toggle(tag.id)}
              label={tag.label}
              tag={tag}
            />
          ))}
        </div>
      </div>
    </BottomDrawer>
  )
}

function FilterRow({
  checked,
  onToggle,
  label,
  tag,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  tag?: MapItemTag
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the Checkbox inside is the control
    <label className="flex cursor-pointer items-center gap-2.5 rounded-xl corner-squircle px-1.5 py-1.5 active:bg-foreground/5">
      {tag ? (
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[0.7rem] corner-squircle"
          style={tagColorStyle(tag.color, false)}
        >
          <Icon icon={tag.icon} className="size-4" />
        </span>
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-[0.7rem] corner-squircle bg-foreground/10">
          <Icon icon={ICONS.filter} className="size-4 text-foreground/70" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {label}
      </span>
      <Checkbox
        checked={checked}
        onCheckedChange={() => {
          triggerHaptic()
          onToggle()
        }}
        className="size-5 rounded-md corner-squircle"
      />
    </label>
  )
}
