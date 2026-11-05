"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { tagColorStyle } from "./tagColor"
import type { MapItem } from "./types"

// @some-pin-id inside a description, e.g. "bring cash to the @atms first"
const MENTION = /@([a-z0-9][a-z0-9-]*)/gi

// a description where @mentions of other places become small tappable chips with the place's icon.
// Hovering one slides the map to that place (and back when the pointer leaves), an arrow appears at
// its top right, and clicking opens that place. An @ that isn't a real place stays plain text
export function MentionText({
  text,
  places,
  onOpen,
  onPreview,
}: {
  text: string
  places: MapItem[]
  onOpen: (item: MapItem) => void
  onPreview: (item: MapItem | null) => void
}) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(MENTION)) {
    const place = places.find(
      (item) => item.id.toLowerCase() === match[1].toLowerCase(),
    )
    if (!place) continue
    const start = match.index ?? 0
    parts.push(text.slice(last, start))
    parts.push(
      <button
        key={`${start}-${place.id}`}
        type="button"
        onClick={() => onOpen(place)}
        // a mouse hovering shows where it is; a finger just taps to open
        onPointerEnter={(event) =>
          event.pointerType === "mouse" && onPreview(place)
        }
        onPointerLeave={(event) =>
          event.pointerType === "mouse" && onPreview(null)
        }
        onFocus={() => onPreview(place)}
        onBlur={() => onPreview(null)}
        className="group/mention relative mx-0.5 inline-flex items-center gap-1 rounded-[0.6rem] corner-squircle px-1.5 py-0.5 align-baseline font-medium leading-snug transition-[filter] hover:brightness-95"
        style={tagColorStyle(place.tag.color, true)}
      >
        <Icon icon={place.tag.icon} className="size-3.5 shrink-0" />
        {place.title}
        <span className="absolute -top-2 -right-2 grid size-4 scale-0 place-items-center rounded-[0.4rem] corner-squircle bg-foreground text-background transition-transform group-hover/mention:scale-100 group-focus-visible/mention:scale-100 [@media(hover:none)]:scale-100">
          <Icon icon={ICONS.externalLink} className="size-2.5" />
        </span>
      </button>,
    )
    last = start + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
