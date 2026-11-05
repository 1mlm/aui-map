"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import type { SearchMode } from "./searchEngine"
import { tagColorStyle } from "./tagColor"
import type { MapItem, MapItemTag } from "./types"

export type SuggestionRow = {
  item: MapItem
  // "5 min walk" style hint, only when the visitor's own position is known
  distance?: string
}

// what opens under the search bar. Meant for someone who has never used a map app: with nothing typed
// it offers where people usually go and the kinds of places there are, while typing it lists what
// matches (even misspelled, even described as a need), and when nothing matches it says so kindly
// and still gives them somewhere to go
export function SearchSuggestions({
  query,
  mode,
  concept,
  rows,
  recentCount,
  tags,
  activeIndex,
  totalMatches,
  onPick,
  onPickTag,
  onNearest,
  className,
}: {
  query: string
  mode: SearchMode
  concept?: string
  rows: SuggestionRow[]
  // how many of the first rows are "recent" (empty search only)
  recentCount: number
  tags: MapItemTag[]
  activeIndex: number
  // more matches than rows shown: the rest are on the map itself
  totalMatches: number
  onPick: (item: MapItem) => void
  onPickTag: (tag: MapItemTag) => void
  // a group of places ("food") without a known position: offer to find the closest one
  onNearest?: () => void
  className?: string
}) {
  const empty = mode === "empty" || mode === "none"

  return (
    // the input must keep focus while this is pressed, or the panel would close before the tap lands
    <div
      role="listbox"
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "pointer-events-auto flex flex-col gap-1 overflow-y-auto rounded-3xl corner-superellipse/1.2 bg-background/95 p-2 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md",
        className,
      )}
    >
      {mode === "none" && (
        <div className="flex items-center gap-2 px-2.5 py-2 text-sm">
          <Icon icon={ICONS.search} className="size-4 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1 truncate">
            Nothing called <b>{query.trim()}</b> yet
          </span>
        </div>
      )}
      {mode === "concept" && concept && (
        <Label>
          {concept}
          {totalMatches > rows.length ? ` · ${totalMatches} on the map` : ""}
        </Label>
      )}
      {mode === "fuzzy" && <Label>Did you mean</Label>}
      {mode === "concept" && onNearest && (
        <button
          type="button"
          onClick={onNearest}
          className="mx-1 mb-1 flex items-center justify-center gap-1.5 rounded-full corner-squircle bg-primary px-3 py-2 font-semibold text-primary-foreground text-sm"
        >
          <Icon icon={ICONS.locate} className="size-4" />
          Nearest first
        </button>
      )}
      {mode === "empty" && recentCount > 0 && <Label>Recent</Label>}

      {rows.map((row, index) => (
        <div key={row.item.id}>
          {empty && index === recentCount && <Label>Popular</Label>}
          <button
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onClick={() => onPick(row.item)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl corner-squircle px-2.5 py-2 text-left transition-colors hover:bg-foreground/8",
              index === activeIndex && "bg-foreground/10",
            )}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-xl"
              style={tagColorStyle(row.item.tag.color, true)}
            >
              <Icon icon={row.item.tag.icon} className="size-[1.125rem]" />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">
                {row.item.title}
              </span>
              <span className="block truncate text-muted-foreground text-xs">
                {row.item.tag.label}
                {row.item.aliases.filter(Boolean).length > 0 &&
                  ` · ${row.item.aliases.filter(Boolean).slice(0, 2).join(", ")}`}
              </span>
            </span>
            {row.distance && (
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {row.distance}
              </span>
            )}
          </button>
        </div>
      ))}

      {empty && tags.length > 0 && (
        <div className="px-1 pt-1">
          <Label>Browse</Label>
          <div className="flex flex-wrap gap-1.5 px-1.5 pt-1 pb-1">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onPickTag(tag)}
                className="flex items-center gap-1.5 rounded-full corner-squircle px-3 py-1.5 font-medium text-xs"
                style={tagColorStyle(tag.color, true)}
              >
                <Icon icon={tag.icon} className="size-3.5" />
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pt-1 font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wide">
      {children}
    </p>
  )
}
