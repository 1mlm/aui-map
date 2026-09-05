"use client"

import { track } from "@vercel/analytics"
import { AnimatePresence } from "motion/react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { latLongToPosition } from "./geo"
import { LocateFloatingButton } from "./LocateFloatingButton"
import { MapBrand } from "./MapBrand"
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas"
import { MapControls } from "./MapControls"
import { MapCredit, NoticeDialog } from "./MapCredit"
import { MapDetailPanel, UNDOCKED_PANEL_WIDTH } from "./MapDetailPanel"
import { DEFAULT_PIN_SIZE_TUNING, type PinSizeTuning } from "./MapPin"
import { MapFilterBar } from "./MapTagFilter"
import { NetworkStatusBanner } from "./NetworkStatusBanner"
import { DEFAULT_CRAYON_TUNING, type TagColorName } from "./tagColor"
import type { MapItem, MapItemTag, MapPanorama } from "./types"
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

// strips everything but letters/digits before comparing, so "aud17" matches both the id
// ("aud17") and the title ("AUD 17") -- spaces, hyphens, whatever punctuation someone's aliases
// happen to use shouldn't be a reason a real match doesn't show up
function normalizeForSearch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function matchesSearch(item: MapItem, query: string) {
  if (!query) return true
  const normalizedQuery = normalizeForSearch(query)
  return [item.id, item.title, ...item.aliases].some((value) =>
    normalizeForSearch(value).includes(normalizedQuery),
  )
}

// long enough that it only fires once someone's actually done typing, not on every keystroke
const ZERO_RESULT_SEARCH_TRACK_DELAY_MS = 800

export function MapExperience({
  items,
  tags,
  panoramas,
}: {
  items: MapItem[]
  tags: MapItemTag[]
  panoramas: MapPanorama[]
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const mapCanvasRef = useRef<MapCanvasHandle>(null)
  const space = useAvailableSpace(shellRef)
  const location = useUserLocation()
  const compass = useCompassHeading()
  useWakeLock()

  // requests location if it isn't already, and — unlike the passive first-fix auto-center —
  // always jumps the view back regardless of whether the user's already panned elsewhere,
  // since clicking the button is unambiguous intent to recenter. Also asks for orientation in
  // the same tap so a first-time grant is one click instead of two -- must come before any
  // `await` in this function, iOS only honors DeviceOrientationEvent.requestPermission() while
  // still inside the click's own gesture (same rule PanoramaCapture's handleStart follows)
  function handleLocate() {
    compass.requestPermission()
    location.requestLocation()
    if (location.position) mapCanvasRef.current?.centerOn(location.position)
  }

  // nothing left to grant once both are settled -- gone for good until the next full page load.
  // Computed here (not inside LocateFloatingButton) so AnimatePresence below can actually see it
  // go from false to true and animate the button out, instead of the button unmounting itself
  // mid-render with no transition to play
  const locateButtonDone =
    location.status === "granted" && compass.permission !== "idle"

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
  const contributePins = effectiveItems.map((item) => ({
    id: item.id,
    title: item.title,
    icon: item.tag.icon,
  }))
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
  const clearTags = () => setActiveTagIds(new Set())

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

  // once a search narrows the map down to a single pin there's nothing left to browse, so open
  // it straight away and jump the map there too -- instead of making "which one did I mean" or
  // "where actually is that" separate steps once typing has already said so unambiguously
  useEffect(() => {
    if (!search.trim()) return
    if (visibleItems.length !== 1) return
    const [onlyMatch] = visibleItems
    if (onlyMatch.id === selectedId) return
    setSelectedId(onlyMatch.id)
    mapCanvasRef.current?.centerOn(
      latLongToPosition(onlyMatch.latitude, onlyMatch.longitude),
    )
  }, [search, visibleItems, selectedId, setSelectedId])

  return (
    // the mobile bottom-12 reservation is exactly what MapCredit's fuser patches need below the
    // shell to grow out of -- same bg-background on both, so the pill and the strip it sits in
    // read as one continuous shape rather than a bar dropped on top of a gap
    <div className="relative h-dvh w-dvw bg-background pb-12 sm:p-3">
      {/* the shell's shadow is dark-mode only: the gutter around it and the corner fusers inside it
          are both bg-background, so in light mode the only thing separating them was this shadow
          spilling outward and greying the gutter to ~250 against the fusers' 255, which read as a
          seam exactly where the chrome is supposed to look fused into the frame */}
      <div
        ref={shellRef}
        className="map-shell relative h-full w-full overflow-hidden rounded-b-[2rem] corner-b-superellipse/1.2 bg-background sm:rounded-[3rem] sm:corner-squircle dark:sm:shadow-2xl"
      >
        <MapCanvas
          ref={mapCanvasRef}
          items={visibleItems}
          onSelect={setSelectedId}
          userPosition={location.position}
          userAccuracy={location.accuracy}
          offCampusPosition={location.isOffCampus ? location.rawPosition : null}
          compassHeading={compass.heading}
          {...{ selectedId, hoveredTagId, tuning, sizeTuning, panoramas }}
        />

        {/* softens the map's own imagery into the shell's background right where it meets the
            credit strip below, instead of the photo just cutting off hard at the rounded corner.
            bg-background-based gradient (not a hardcoded black) so it fades to whichever the
            current color-scheme actually is. Desktop's bottom edge is already the fused filter
            bar chrome, not bare map, so this is mobile-only */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background sm:hidden" />

        <MapBrand />
        <NetworkStatusBanner />

        <MapControls
          onSearchChange={setSearch}
          onOpenNotice={() => setNoticeOpen(true)}
          locationStatus={location.status}
          isOffCampus={location.isOffCampus}
          accuracy={location.accuracy}
          onLocate={handleLocate}
          compassPermission={compass.permission}
          onRequestCompass={compass.requestPermission}
          {...{ search, contributePins }}
        />
        <AnimatePresence>
          {!locateButtonDone && (
            <LocateFloatingButton
              key="locate"
              locationStatus={location.status}
              compassPermission={compass.permission}
              onLocate={handleLocate}
              onRequestCompass={compass.requestPermission}
            />
          )}
        </AnimatePresence>

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
          onClearAll={clearTags}
          onHoverTag={setHoveredTagId}
          {...{ activeTagIds, hoveredTagId }}
        />
        <NoticeDialog open={noticeOpen} onOpenChange={setNoticeOpen} />
      </div>

      {/* lives in the pb-12 strip below the shell, not inside it. Mobile's whole substitute for
          the desktop bar's About button -- opens the same NoticeDialog */}
      <div className="sm:hidden">
        <MapCredit onOpenCredits={() => setNoticeOpen(true)} />
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
