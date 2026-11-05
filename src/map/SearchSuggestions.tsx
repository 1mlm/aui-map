"use client"

import { Icon } from "@/components/Icon"
import { ICONS } from "@/icons"
import { cn } from "@/shadcn/utils"
import { tagColorStyle } from "./tagColor"
import type { MapItem } from "./types"

// what opens under the search bar while someone types: the places that match, and nothing else.
// No suggestions for an empty box, no categories, no tips. When nothing matches it just says so
export function SearchSuggestions({
  query,
  items,
  activeIndex,
  onPick,
  className,
}: {
  query: string
  items: MapItem[]
  activeIndex: number
  onPick: (item: MapItem) => void
  className?: string
}) {
  return (
    // the input must keep focus while this is pressed, or the panel would close before the tap lands
    <div
      role="listbox"
      onPointerDown={(event) => event.preventDefault()}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "pointer-events-auto flex flex-col gap-0.5 overflow-y-auto rounded-3xl corner-superellipse/1.2 bg-background/95 p-1.5 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md",
        className,
      )}
    >
      {items.length === 0 && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 text-muted-foreground text-sm">
          <Icon icon={ICONS.search} className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">
            Nothing for <b className="text-foreground">{query.trim()}</b> yet
          </span>
        </div>
      )}
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onClick={() => onPick(item)}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl corner-squircle px-2 py-1.5 text-left transition-colors hover:bg-foreground/8",
            index === activeIndex && "bg-foreground/10",
          )}
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-[0.8rem] corner-squircle"
            style={tagColorStyle(item.tag.color, true)}
          >
            <Icon icon={item.tag.icon} className="size-[1.1rem]" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">
              {item.title}
            </span>
            <span className="block truncate text-muted-foreground text-xs">
              {item.tag.label}
              {item.aliases.filter(Boolean).length > 0 &&
                ` · ${item.aliases.filter(Boolean).slice(0, 2).join(", ")}`}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}
