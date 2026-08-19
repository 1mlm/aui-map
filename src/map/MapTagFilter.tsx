"use client"

import { motion } from "motion/react"
import { Icon } from "@/components/Icon"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
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
