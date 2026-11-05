"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import type { MapItem } from "./types"

// @some-pin-id inside a description, e.g. "bring cash to the @atms first"
const MENTION = /@([a-z0-9][a-z0-9-]*)/gi

// a description where @mentions of other places become quiet grey inline chips with the place's
// icon. Hovering one slides the map to that place (and back when the pointer leaves) and an arrow
// slides in after the name. Clicking opens that place. An @ that isn't a real place stays plain text
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
        className="group/mention inline-flex items-baseline rounded-[0.45em] corner-squircle bg-foreground/[0.07] px-[0.3em] align-baseline font-medium text-foreground transition-colors hover:bg-foreground/[0.14] focus-visible:bg-foreground/[0.14] focus-visible:outline-none"
      >
        <Icon
          icon={place.tag.icon}
          className="mr-[0.25em] size-[0.95em] shrink-0 self-center text-foreground/55"
        />
        {place.title}
        {/* slides in on hover. Phones have no hover, so it's always there */}
        <span className="inline-grid w-0 self-center overflow-hidden opacity-0 transition-[width,margin,opacity] duration-200 ease-out group-hover/mention:ml-[0.15em] group-hover/mention:w-[0.8em] group-hover/mention:opacity-100 group-focus-visible/mention:ml-[0.15em] group-focus-visible/mention:w-[0.8em] group-focus-visible/mention:opacity-100 [@media(hover:none)]:ml-[0.15em] [@media(hover:none)]:w-[0.8em] [@media(hover:none)]:opacity-100">
          <Icon
            icon={ICONS.externalLink}
            className="size-[0.8em] text-foreground/55"
          />
        </span>
      </button>,
    )
    last = start + match[0].length
  }
  parts.push(text.slice(last))
  return <>{parts}</>
}
