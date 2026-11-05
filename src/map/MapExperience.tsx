"use client"

import { AnimatePresence, LazyMotion } from "motion/react"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { triggerHaptic } from "@/utils/haptics"
import { CoordinateResult } from "./CoordinateResult"
import {
  latLongToPosition,
  parseCoordinateQuery,
  positionToLatLong,
} from "./geo"
import { LocateFloatingButton } from "./LocateFloatingButton"
import { MapBrand } from "./MapBrand"
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas"
import { MapControls } from "./MapControls"
import { DEFAULT_PIN_SIZE_TUNING, type PinSizeTuning } from "./MapPin"
import { MapFilterBar } from "./MapTagFilter"
import { NetworkStatusBanner } from "./NetworkStatusBanner"
import { UNDOCKED_PANEL_WIDTH } from "./panelWidth"
import { SearchSuggestions, type SuggestionRow } from "./SearchSuggestions"
import { searchPlaces } from "./searchEngine"
import { recordSearchMiss } from "./searchMissActions"
import { DEFAULT_CRAYON_TUNING, type TagColorName } from "./tagColor"
import type { MapItem, MapItemTag } from "./types"
import { useAvailableSpace } from "./useAvailableSpace"
import { useCompassHeading } from "./useCompassHeading"
import { usePinSelection } from "./usePinSelection"
import { useShakeGesture } from "./useShakeGesture"
import { useUserLocation } from "./useUserLocation"
import { useWakeLock } from "./useWakeLock"

// flip true to bring back the leva tag-color/tuning playground
const LEVA_PLAYGROUND_ENABLED = false
// flip true to bring back the leva pin-size/label playground
const PIN_SIZE_PLAYGROUND_ENABLED = false

// not needed to paint the map: the detail panel is fetched when idle (so the first tap is
// instant) and About only when someone opens it
const loadDetailPanel = () => import("./MapDetailPanel")
const MapDetailPanel = dynamic(() =>
  loadDetailPanel().then((m) => m.MapDetailPanel),
)
const InstallNudge = dynamic(
  () => import("./InstallNudge").then((m) => m.InstallNudge),
  { ssr: false },
)
const About = dynamic(() => import("./About").then((m) => m.About), {
  ssr: false,
})

const loadMotionFeatures = () =>
  import("./motionFeatures").then((m) => m.default)

// dev-only — code-split so leva (and this whole file) never reaches production visitors
const TagColorPlayground = dynamic(
  () => import("./TagColorPlayground").then((m) => m.TagColorPlayground),
  { ssr: false },
)
const PinTuningPlayground = dynamic(
  () => import("./PinTuningPlayground").then((m) => m.PinTuningPlayground),
  { ssr: false },
)

// the places people go most, offered when the search box is empty or nothing matched. Any that
// don't exist on the current map are skipped
const POPULAR_IDS = [
  "m6l",
  "cossa",
  "health-center",
  "main-gate",
  "gym",
  "bookstore",
  "registrar",
  "post-office",
  "mosque",
]
const RECENT_KEY = "aui_recent_places"

// straight-line meters between two spots on the map (haversine)
function metersBetween(a: [number, number], b: [number, number]) {
  const [p, q] = [positionToLatLong(a), positionToLatLong(b)]
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(q.latitude - p.latitude) / 2) ** 2 +
    Math.cos(rad(p.latitude)) *
      Math.cos(rad(q.latitude)) *
      Math.sin(rad(q.longitude - p.longitude) / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
const distanceLabel = (meters: number) =>
  meters < 1000
    ? `${Math.max(10, Math.round(meters / 10) * 10)} m`
    : `${(meters / 1000).toFixed(1)} km`

// long enough that it only fires once someone's actually done typing, not on every keystroke
const ZERO_RESULT_SEARCH_TRACK_DELAY_MS = 800

export function MapExperience({
  items,
  tags,
  initialSelectedId = null,
}: {
  items: MapItem[]
  tags: MapItemTag[]
  initialSelectedId?: string | null
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
  // still inside the click's own gesture
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
  const [aboutOpen, setAboutOpen] = useState(false)
  // About stays mounted once it has been opened, so closing it can still animate out
  const [aboutMounted, setAboutMounted] = useState(false)

  // warm the detail panel chunk once the map has painted and the browser is idle
  useEffect(() => {
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500))
    const handle = idle(() => void loadDetailPanel())
    return () => {
      if (window.cancelIdleCallback && typeof handle === "number")
        window.cancelIdleCallback(handle)
    }
  }, [])
  // in the url path so a place can be linked to directly: /m6l
  const [selectedId, setSelectedId] = usePinSelection(initialSelectedId)

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
  // what the search bar understood: the places (or group of places) to show. When nothing matched
  // the map is left alone instead of going blank, and the suggestions say so
  const coordinateSearch = parseCoordinateQuery(search) !== null
  const outcome = searchPlaces(coordinateSearch ? "" : search, effectiveItems)
  const matchedIds = outcome.hits.length
    ? new Set(outcome.hits.map((hit) => hit.item.id))
    : null
  const visibleItems = effectiveItems.filter(
    (item) =>
      (matchedIds === null || matchedIds.has(item.id)) &&
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
      if (
        !parseCoordinateQuery(query) &&
        searchPlaces(query, effectiveItems).mode === "none"
      )
        recordSearchMiss(query)
    }, ZERO_RESULT_SEARCH_TRACK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search, effectiveItems])

  // typing coordinates (people do) marks that spot, flies there and offers it to a maps app
  const searchedCoordinates = parseCoordinateQuery(search)
  const searchedPosition = searchedCoordinates
    ? latLongToPosition(
        searchedCoordinates.latitude,
        searchedCoordinates.longitude,
      )
    : null
  const searchedOnCampus =
    searchedPosition !== null &&
    searchedPosition[0] > -0.03 &&
    searchedPosition[0] < 1.03 &&
    searchedPosition[1] > -0.03 &&
    searchedPosition[1] < 1.03
  const searchedKey = searchedCoordinates
    ? `${searchedCoordinates.latitude},${searchedCoordinates.longitude}`
    : null
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a different place should fly the map, not every render
  useEffect(() => {
    if (!searchedPosition || !searchedOnCampus) return
    triggerHaptic("success")
    mapCanvasRef.current?.centerOn(searchedPosition)
  }, [searchedKey])

  // once a search narrows the map down to a single pin there's nothing left to browse, so open
  // it straight away and jump the map there too -- instead of making "which one did I mean" or
  // "where actually is that" separate steps once typing has already said so unambiguously
  useEffect(() => {
    if (!search.trim()) return
    if (outcome.mode !== "places" || visibleItems.length !== 1) return
    const [onlyMatch] = visibleItems
    if (onlyMatch.id === selectedId) return
    // a tap in the hand, so a phone user feels the jump even with the keyboard covering half the map
    triggerHaptic("success")
    setSelectedId(onlyMatch.id)
    mapCanvasRef.current?.centerOn(
      latLongToPosition(onlyMatch.latitude, onlyMatch.longitude),
    )
  }, [search, visibleItems, selectedId, setSelectedId, outcome.mode])

  // ---- the suggestions under the search bar ----
  const [searchFocused, setSearchFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentIds, setRecentIds] = useState<string[]>([])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
      if (Array.isArray(saved))
        setRecentIds(saved.filter((id) => typeof id === "string"))
    } catch {}
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new word starts from the top of the list again
  useEffect(() => setActiveIndex(-1), [search])

  const searchQuery = search.trim()
  const nothingTyped = !searchQuery || coordinateSearch
  const distanceOf = (item: MapItem) =>
    location.position
      ? metersBetween(
          location.position,
          latLongToPosition(item.latitude, item.longitude),
        )
      : undefined
  const popular = POPULAR_IDS.map((id) =>
    effectiveItems.find((item) => item.id === id),
  ).filter((item): item is MapItem => Boolean(item))
  const recent = recentIds
    .map((id) => effectiveItems.find((item) => item.id === id))
    .filter((item): item is MapItem => Boolean(item))
    .slice(0, 3)
  let rowItems: MapItem[]
  let recentCount = 0
  if (nothingTyped) {
    recentCount = recent.length
    rowItems = [
      ...recent,
      ...popular.filter((item) => !recent.includes(item)),
    ].slice(0, 6)
  } else if (outcome.mode === "none") rowItems = popular.slice(0, 4)
  else {
    let hits = outcome.hits.map((hit) => hit.item)
    // "food" / "doctor": the nearest first, when the visitor's position is known
    if (outcome.mode === "concept" && location.position)
      hits = [...hits].sort(
        (a, b) => (distanceOf(a) ?? 0) - (distanceOf(b) ?? 0),
      )
    rowItems = hits.slice(0, outcome.mode === "concept" ? 8 : 6)
  }
  const suggestionRows: SuggestionRow[] = rowItems.map((item) => {
    const meters = distanceOf(item)
    return {
      item,
      distance: meters === undefined ? undefined : distanceLabel(meters),
    }
  })
  const showSuggestions =
    searchFocused &&
    !coordinateSearch &&
    // a single place that is already open needs no list
    !(
      outcome.mode === "places" &&
      suggestionRows.length === 1 &&
      suggestionRows[0].item.id === selectedId
    )

  const blurSearch = () =>
    (document.activeElement as HTMLElement | null)?.blur()
  function pickItem(item: MapItem) {
    triggerHaptic("selection")
    setSelectedId(item.id)
    mapCanvasRef.current?.centerOn(
      latLongToPosition(item.latitude, item.longitude),
    )
    setSearch("")
    setRecentIds((previous) => {
      const next = [item.id, ...previous.filter((id) => id !== item.id)].slice(
        0,
        5,
      )
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
    blurSearch()
  }
  function pickTag(tag: MapItemTag) {
    triggerHaptic("selection")
    setActiveTagIds(new Set([tag.id]))
    setSearch("")
    blurSearch()
  }
  // arrows move through the list, Enter opens the highlighted place (or the first one)
  function handleSearchKey(key: "up" | "down" | "enter" | "escape") {
    if (key === "escape") {
      blurSearch()
      return true
    }
    if (key === "down" || key === "up") {
      if (!suggestionRows.length) return false
      const step = key === "down" ? 1 : -1
      setActiveIndex(
        (i) => (i + step + suggestionRows.length) % suggestionRows.length,
      )
      return true
    }
    if (nothingTyped || outcome.mode === "none") return false
    const row = suggestionRows[activeIndex >= 0 ? activeIndex : 0]
    if (!row) return false
    pickItem(row.item)
    return true
  }

  return (
    <LazyMotion features={loadMotionFeatures}>
      <div className="relative h-dvh w-dvw bg-background sm:p-3">
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
            offCampusPosition={
              location.isOffCampus ? location.rawPosition : null
            }
            compassHeading={compass.heading}
            searchedPosition={searchedOnCampus ? searchedPosition : null}
            {...{ selectedId, hoveredTagId, tuning, sizeTuning }}
          />

          <MapBrand />
          <NetworkStatusBanner />
          {searchedCoordinates && (
            <CoordinateResult
              {...searchedCoordinates}
              onCampus={searchedOnCampus}
              onClose={() => setSearch("")}
            />
          )}

          <MapControls
            onSearchChange={setSearch}
            onOpenAbout={() => {
              setAboutMounted(true)
              setAboutOpen(true)
            }}
            locationStatus={location.status}
            isOffCampus={location.isOffCampus}
            accuracy={location.accuracy}
            onLocate={handleLocate}
            compassPermission={compass.permission}
            onRequestCompass={compass.requestPermission}
            onFocusChange={setSearchFocused}
            onSearchKey={handleSearchKey}
            {...{ search }}
          />
          {showSuggestions && (
            <SearchSuggestions
              className="absolute inset-x-3 top-[4.25rem] z-40 max-h-[min(30rem,calc(100dvh-7rem))] sm:inset-x-auto sm:top-[3.75rem] sm:right-3 sm:w-96"
              query={search}
              mode={nothingTyped ? "empty" : outcome.mode}
              concept={outcome.concept}
              rows={suggestionRows}
              recentCount={recentCount}
              tags={effectiveTags}
              activeIndex={activeIndex}
              totalMatches={outcome.hits.length}
              onPick={pickItem}
              onPickTag={pickTag}
              onNearest={location.position ? undefined : handleLocate}
            />
          )}
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

          <InstallNudge />
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
          {aboutMounted && (
            <About open={aboutOpen} onOpenChange={setAboutOpen} />
          )}
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
    </LazyMotion>
  )
}
