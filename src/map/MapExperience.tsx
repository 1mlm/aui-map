"use client"

import { track } from "@vercel/analytics"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { MapBrand } from "./MapBrand"
import { ContributeDialog } from "./ContributeDialog"
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas"
import { MapControls } from "./MapControls"
import { NoticeDialog } from "./MapCredit"
import { MapDetailPanel, UNDOCKED_PANEL_WIDTH } from "./MapDetailPanel"
import { DEFAULT_PIN_SIZE_TUNING, type PinSizeTuning } from "./MapPin"
import { MapFilterBar } from "./MapTagFilter"
import { NetworkStatusBanner } from "./NetworkStatusBanner"
import { DEFAULT_CRAYON_TUNING, type TagColorName } from "./tagColor"
import type { MapItem, MapItemTag } from "./types"
import { useAvailableSpace } from "./useAvailableSpace"
import { useCompassHeading } from "./useCompassHeading"
import { useHashState } from "./useHashState"
import { useShakeGesture } from "./useShakeGesture"
import { useUserLocation } from "./useUserLocation"
import { useWakeLock } from "./useWakeLock"

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

// long enough that it only fires once someone's actually done typing, not on every keystroke
const ZERO_RESULT_SEARCH_TRACK_DELAY_MS = 800

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
  useWakeLock()

  // requests location if it isn't already, and — unlike the passive first-fix auto-center —
  // always jumps the view back regardless of whether the user's already panned elsewhere,
  // since clicking the button is unambiguous intent to recenter
  function handleLocate() {
    location.requestLocation()
    if (location.position) mapCanvasRef.current?.centerOn(location.position)
  }

  // a real shake is the same "get me back to where I am" intent as tapping the locate button —
  // handy one-handed outdoors, where reaching for a tiny on-screen button while walking is
  // more awkward than just shaking the phone. Only recenters an existing fix, never requests
  // location itself — useUserLocation deliberately waits for an explicit tap on non-desktop
  // instead of auto-fetching, and a jostle-triggered permission prompt would undo that
  useShakeGesture(() => {
    if (location.status === "granted" && location.position)
      mapCanvasRef.current?.centerOn(location.position)
  })

  // best-effort ask not to have the offline map cache silently evicted under storage pressure —
  // no permission prompt, browsers just grant or don't based on site engagement signals
  useEffect(() => {
    navigator.storage?.persist?.()
  }, [])

  const [search, setSearch] = useState("")
  const [activeTagIds, setActiveTagIds] = useState<Set<string>>(new Set())
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  // in the url hash so a place can be linked to directly: /#m6l
  const [selectedId, setSelectedId] = useHashState()

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

  // finds missing pins/aliases from real usage: a search term matching nothing anywhere on the
  // map (checked against the whole map, not visibleItems, so an active tag filter can't produce
  // a false "no results" for a term that's really just filtered out). Debounced so this only
  // fires once someone's paused typing, not once per keystroke
  useEffect(() => {
    const query = search.trim()
    if (!query) return
    const timer = setTimeout(() => {
      const matchesSomething = effectiveItems.some((item) =>
        matchesSearch(item, query),
      )
      if (!matchesSomething)
        track("search_no_results", { query: query.toLowerCase() })
    }, ZERO_RESULT_SEARCH_TRACK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, effectiveItems])

  return (
    <div className="h-dvh w-dvw bg-background sm:p-3">
      {/* the shell's shadow is dark-mode only: the gutter around it and the corner fusers inside it
          are both bg-background, so in light mode the only thing separating them was this shadow
          spilling outward and greying the gutter to ~250 against the fusers' 255, which read as a
          seam exactly where the chrome is supposed to look fused into the frame */}
      <div
        ref={shellRef}
        className="map-shell relative h-full w-full overflow-hidden bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl"
      >
        <MapCanvas
          ref={mapCanvasRef}
          items={visibleItems}
          onSelect={setSelectedId}
          userPosition={location.position}
          userAccuracy={location.accuracy}
          offCampusPosition={location.isOffCampus ? location.rawPosition : null}
          compassHeading={compass.heading}
          compassPermission={compass.permission}
          onRequestCompass={compass.requestPermission}
          {...{ selectedId, hoveredTagId, tuning, sizeTuning }}
        />

        <MapBrand />
        <NetworkStatusBanner />

        <MapControls
          tags={effectiveTags}
          onToggle={toggleTag}
          onSearchChange={setSearch}
          onHoverTag={setHoveredTagId}
          onOpenNotice={() => setNoticeOpen(true)}
          onOpenContribute={() => setContributeOpen(true)}
          locationStatus={location.status}
          isOffCampus={location.isOffCampus}
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

        <MapFilterBar
          reservedRight={
            selected && !space.docksPanel ? UNDOCKED_PANEL_WIDTH : "0rem"
          }
          tags={effectiveTags}
          onToggle={toggleTag}
          onHoverTag={setHoveredTagId}
          {...{ activeTagIds, hoveredTagId }}
        />
        <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} />
        <ContributeDialog
          open={contributeOpen}
          onOpenChange={setContributeOpen}
        />
      </div>

      {LEVA_PLAYGROUND_ENABLED && process.env.NODE_ENV === "development" && (
        <TagColorPlayground
          onColorChange={(tagId, color) =>
            setColorOverrides((current) => ({ ...current, [tagId]: color }))
          }
          {...{ tags, tuning }}
          onTuningChange={setTuning}
        />
      )}
      {PIN_SIZE_PLAYGROUND_ENABLED &&
        process.env.NODE_ENV === "development" && (
          <PinTuningPlayground
            tuning={sizeTuning}
            onTuningChange={(patch) =>
              setSizeTuning((current) => ({ ...current, ...patch }))
            }
          />
        )}
    </div>
  )
}
