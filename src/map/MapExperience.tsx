"use client"

import { AnimatePresence } from "motion/react"
import { useQueryState } from "nuqs"
import { useRef, useState } from "react"
import { MapBrand } from "./MapBrand"
import { MapCanvas } from "./MapCanvas"
import { MapControls } from "./MapControls"
import { MapCredit, NoticeDialog } from "./MapCredit"
import { MapDetailPanel } from "./MapDetailPanel"
import type { MapItem, MapItemTag } from "./types"
import { useAvailableSpace } from "./useAvailableSpace"
import { useUserLocation } from "./useUserLocation"

function matchesSearch(item: MapItem, query: string) {
  if (!query) return true
  const q = query.toLowerCase()
  return [item.title, ...item.aliases].some((name) =>
    name.toLowerCase().includes(q),
  )
}

export function MapExperience({
  items,
  tags,
}: {
  items: MapItem[]
  tags: MapItemTag[]
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const space = useAvailableSpace(shellRef)
  const location = useUserLocation()

  const [search, setSearch] = useState("")
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  // in the url so a place can be linked to directly: /?focus=m6l
  const [selectedId, setSelectedId] = useQueryState("focus")

  const selected = items.find((item) => item.id === selectedId) ?? null
  const visibleItems = items.filter(
    (item) =>
      matchesSearch(item, search) &&
      (activeTagIds.size === 0 || activeTagIds.has(item.tag.id)),
  )

  const toggleTag = (tagId: string) =>
    setActiveTagIds((previous) => {
      const next = new Set(previous)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })

  return (
    <div className="h-dvh w-dvw bg-background sm:p-3">
      <div
        ref={shellRef}
        className="relative h-full w-full overflow-hidden bg-background sm:rounded-[3rem] sm:corner-squircle sm:shadow-2xl"
      >
        <MapCanvas
          items={visibleItems}
          onSelect={setSelectedId}
          userPosition={location.position}
          {...{ selectedId, hoveredTagId }}
        />

        {space.showsProjectName && <MapBrand />}

        <MapControls
          {...{ tags }}
          onToggle={toggleTag}
          onSearchChange={setSearch}
          onHoverTag={setHoveredTagId}
          compact={!space.showsFullCredit}
          onOpenNotice={() => setNoticeOpen(true)}
          {...{ search, activeTagIds, hoveredTagId }}
        />

        <AnimatePresence>
          {selected && (
            <MapDetailPanel
              item={selected}
              onClose={() => setSelectedId(null)}
              docked={space.docksPanel}
            />
          )}
        </AnimatePresence>

        {space.showsFullCredit && (
          <MapCredit onOpen={() => setNoticeOpen(true)} />
        )}
        <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} />
      </div>
    </div>
  )
}
