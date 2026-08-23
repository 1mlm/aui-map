"use client"

import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useQueryState } from "nuqs"
import { useRef, useState } from "react"
import { MapBrand } from "./MapBrand"
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas"
import { MapControls } from "./MapControls"
import { MapCredit, NoticeDialog } from "./MapCredit"
import { MapDetailPanel } from "./MapDetailPanel"
import { DEFAULT_PIN_SIZE_TUNING, type PinSizeTuning } from "./MapPin"
import { DEFAULT_CRAYON_TUNING, type TagColorName } from "./tagColor"
import type { MapItem, MapItemTag } from "./types"
import { useAvailableSpace } from "./useAvailableSpace"
import { useCompassHeading } from "./useCompassHeading"
import { useUserLocation } from "./useUserLocation"

// flip true to bring back the leva tag-color/tuning playground
const LEVA_PLAYGROUND_ENABLED = false
// flip true to bring back the leva pin-size/label playground
const PIN_SIZE_PLAYGROUND_ENABLED = false

// dev-only — code-split so leva (and this whole file) never reaches production visitors
const TagColorPlayground = dynamic(
  () => import("./TagColorPlayground").then((m) => m.TagColorPlayground),
  { ssr: false },
)
const PinTuningPlayground = dynamic(
  () => import("./PinTuningPlayground").then((m) => m.PinTuningPlayground),
  { ssr: false },
)

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
  const mapCanvasRef = useRef<MapCanvasHandle>(null)
  const space = useAvailableSpace(shellRef)
  const location = useUserLocation()
  const compass = useCompassHeading()

  // requests location if it isn't already, and — unlike the passive first-fix auto-center —
  // always jumps the view back regardless of whether the user's already panned elsewhere,
  // since clicking the button is unambiguous intent to recenter
  function handleLocate() {
    location.requestLocation()
    if (location.position) mapCanvasRef.current?.centerOn(location.position)
  }

  const [search, setSearch] = useState("")
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  // in the url so a place can be linked to directly: /?focus=m6l
  const [selectedId, setSelectedId] = useQueryState("focus")

  // dev-only live color overrides from TagColorPlayground — never populated in production, so
  // this is a no-op merge there. Keyed by tag id, applied to both the tags list (for the filter
  // pills) and each item's embedded tag (for the pins themselves)
  const [colorOverrides, setColorOverrides] = useState<
    Record<string, TagColorName>
  >({})
  // dev-only live crayon-treatment tuning from TagColorPlayground — never populated in
  // production, so pins always fall back to tagColor.ts's DEFAULT_CRAYON_TUNING there
  const [tuning, setTuning] = useState(DEFAULT_CRAYON_TUNING)
  // dev-only live pin size/label tuning from PinTuningPlayground — never populated in
  // production, so pins always fall back to MapPin's own DEFAULT_PIN_SIZE_TUNING there
  const [sizeTuning, setSizeTuning] = useState<PinSizeTuning>(
    DEFAULT_PIN_SIZE_TUNING,
  )
  const effectiveTags = tags.map((tag) =>
    colorOverrides[tag.id] ? { ...tag, color: colorOverrides[tag.id] } : tag,
  )
  const effectiveTagById = new Map(effectiveTags.map((tag) => [tag.id, tag]))
  const effectiveItems = items.map((item) => ({
    ...item,
    tag: effectiveTagById.get(item.tag.id) ?? item.tag,
  }))

  const selected = effectiveItems.find((item) => item.id === selectedId) ?? null
  const visibleItems = effectiveItems.filter(
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
          ref={mapCanvasRef}
          items={visibleItems}
          onSelect={setSelectedId}
          userPosition={location.position}
          compassHeading={compass.heading}
          compassPermission={compass.permission}
          onRequestCompass={compass.requestPermission}
          {...{ selectedId, hoveredTagId, tuning, sizeTuning }}
        />

        {space.showsProjectName && <MapBrand />}

        <MapControls
          tags={effectiveTags}
          onToggle={toggleTag}
          onSearchChange={setSearch}
          onHoverTag={setHoveredTagId}
          compact={!space.showsFullCredit}
          onOpenNotice={() => setNoticeOpen(true)}
          locationStatus={location.status}
          onLocate={handleLocate}
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

      {LEVA_PLAYGROUND_ENABLED && process.env.NODE_ENV === "development" && (
        <TagColorPlayground
          tags={tags}
          onColorChange={(tagId, color) =>
            setColorOverrides((current) => ({ ...current, [tagId]: color }))
          }
          {...{ tuning }}
          onTuningChange={setTuning}
        />
      )}
      {PIN_SIZE_PLAYGROUND_ENABLED &&
        process.env.NODE_ENV === "development" && (
          <PinTuningPlayground
            tuning={sizeTuning}
            onTuningChange={setSizeTuning}
          />
        )}
    </div>
  )
}
