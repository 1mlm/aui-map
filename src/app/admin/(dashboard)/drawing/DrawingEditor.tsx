"use client"

import {
  FootprintsIcon,
  Image01Icon,
  Pentagon01Icon,
  Route01Icon,
} from "@hugeicons/core-free-icons"
import { useState } from "react"
import { type HugeIcon, Icon } from "@/components/Icon"
import type { CampusShapes } from "@/map/campusShapes"
import type { MapItem, MapItemTag } from "@/map/types"
import { MapEditor } from "../map/MapEditor"
import { MapImageMaker } from "../map-image/MapImageMaker"
import { RoadsEditor } from "../roads/RoadsEditor"
import { WalkLogger } from "../walk/WalkLogger"

type View = "buildings" | "paths" | "image" | "walk"

const VIEWS: { id: View; label: string; icon: HugeIcon }[] = [
  { id: "buildings", label: "Buildings", icon: Pentagon01Icon },
  { id: "paths", label: "Roads and paths", icon: Route01Icon },
  { id: "image", label: "Image", icon: Image01Icon },
  { id: "walk", label: "Walk", icon: FootprintsIcon },
]

// one place for everything about the campus drawing, a tab for each job. A tab is only loaded
// when it is first opened and then kept, so switching never loses what was being drawn
export function DrawingEditor({
  initialView,
  shapes,
  pins,
  items,
  tags,
}: {
  initialView?: string
  shapes: CampusShapes
  pins: { id: string; title: string; x: number; y: number }[]
  items: MapItem[]
  tags: MapItemTag[]
}) {
  const start = VIEWS.some((v) => v.id === initialView)
    ? (initialView as View)
    : "buildings"
  const [view, setView] = useState<View>(start)
  const [opened, setOpened] = useState<Set<View>>(new Set([start]))

  function open(next: View) {
    setView(next)
    setOpened((current) => new Set(current).add(next))
    // so a reload (or the link) comes back to the same tab
    window.history.replaceState(null, "", `/admin/drawing?view=${next}`)
  }

  const show = (id: View) => (view === id ? "block h-full" : "hidden")

  return (
    <div className="flex h-[calc(100dvh-1rem)] flex-col">
      <div className="flex shrink-0 items-center gap-1 p-2 pb-0">
        <div className="flex gap-1 rounded-2xl corner-squircle bg-foreground/5 p-1">
          {VIEWS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => open(id)}
              className={`inline-flex items-center gap-1.5 rounded-xl corner-squircle px-3 py-1.5 text-sm font-medium transition-colors ${
                view === id
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon icon={icon} className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <div className={show("buildings")}>
          <MapEditor initial={shapes} pins={pins} />
        </div>
        <div className={show("paths")}>
          <RoadsEditor initial={shapes} />
        </div>
        {opened.has("image") && (
          <div className={`${show("image")} overflow-auto`}>
            <MapImageMaker {...{ items, tags, shapes }} />
          </div>
        )}
        {opened.has("walk") && (
          <div className={`${show("walk")} overflow-auto`}>
            <WalkLogger />
          </div>
        )}
      </div>
    </div>
  )
}
