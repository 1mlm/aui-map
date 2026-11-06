"use client";

import { AnimatePresence, LazyMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { triggerHaptic } from "@/utils/haptics";
import { CoordinateResult } from "./CoordinateResult";
import { latLongToPosition, parseCoordinateQuery } from "./geo";
import { LocateFloatingButton } from "./LocateFloatingButton";
import { MapBrand } from "./MapBrand";
import type { Area } from "./areas";
import { MapCanvas, type MapCanvasHandle } from "./MapCanvas";
import { MapControls } from "./MapControls";
import { DEFAULT_PIN_SIZE_TUNING, type PinSizeTuning } from "./MapPin";
import { FilterDrawer, MapFilterBar } from "./MapTagFilter";
import { NetworkStatusBanner } from "./NetworkStatusBanner";
import { UNDOCKED_PANEL_WIDTH } from "./panelWidth";
import { SearchSuggestions } from "./SearchSuggestions";
import { searchPlaces } from "./searchEngine";
import { recordSearchMiss } from "./searchMissActions";
import { DEFAULT_CRAYON_TUNING, type TagColorName } from "./tagColor";
import type { MapItem, MapItemTag, PhotoViewPoint } from "./types";
import { useAvailableSpace } from "./useAvailableSpace";
import { useCompassHeading } from "./useCompassHeading";
import { usePinSelection } from "./usePinSelection";
import { useShakeGesture } from "./useShakeGesture";
import { useUserLocation } from "./useUserLocation";
import { useWakeLock } from "./useWakeLock";

// flip true to bring back the leva tag-color/tuning playground
const LEVA_PLAYGROUND_ENABLED = false;
// flip true to bring back the leva pin-size/label playground
const PIN_SIZE_PLAYGROUND_ENABLED = false;

// not needed to paint the map: the detail panel is fetched when idle (so the first tap is
// instant) and About only when someone opens it
const loadDetailPanel = () => import("./MapDetailPanel");
const MapDetailPanel = dynamic(() =>
  loadDetailPanel().then((m) => m.MapDetailPanel),
);
const InstallNudge = dynamic(
  () => import("./InstallNudge").then((m) => m.InstallNudge),
  { ssr: false },
);
const About = dynamic(() => import("./About").then((m) => m.About), {
  ssr: false,
});

const loadMotionFeatures = () =>
  import("./motionFeatures").then((m) => m.default);

// dev-only — code-split so leva (and this whole file) never reaches production visitors
const TagColorPlayground = dynamic(
  () => import("./TagColorPlayground").then((m) => m.TagColorPlayground),
  { ssr: false },
);
const PinTuningPlayground = dynamic(
  () => import("./PinTuningPlayground").then((m) => m.PinTuningPlayground),
  { ssr: false },
);

// long enough that it only fires once someone's actually done typing, not on every keystroke
// long enough that a word still being typed ("intee" on the way to "internet") isn't recorded
const ZERO_RESULT_SEARCH_TRACK_DELAY_MS = 2500;

export function MapExperience({
  items,
  tags,
  areas,
  initialSelectedId = null,
}: {
  items: MapItem[];
  tags: MapItemTag[];
  areas?: Area[];
  initialSelectedId?: string | null;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<MapCanvasHandle>(null);
  const space = useAvailableSpace(shellRef);
  const location = useUserLocation();
  const compass = useCompassHeading();
  useWakeLock();

  // requests location if it isn't already, and — unlike the passive first-fix auto-center —
  // always jumps the view back regardless of whether the user's already panned elsewhere,
  // since clicking the button is unambiguous intent to recenter. Also asks for orientation in
  // the same tap so a first-time grant is one click instead of two -- must come before any
  // `await` in this function, iOS only honors DeviceOrientationEvent.requestPermission() while
  // still inside the click's own gesture
  function handleLocate() {
    compass.requestPermission();
    location.requestLocation();
    if (location.position) mapCanvasRef.current?.centerOn(location.position);
  }

  // nothing left to grant once both are settled -- gone for good until the next full page load.
  // Computed here (not inside LocateFloatingButton) so AnimatePresence below can actually see it
  // go from false to true and animate the button out, instead of the button unmounting itself
  // mid-render with no transition to play
  const locateButtonDone =
    location.status === "granted" && compass.permission !== "idle";

  // a real shake is the same "get me back to where I am" intent as tapping the locate button —
  // handy one-handed outdoors, where reaching for a tiny on-screen button while walking is
  // more awkward than just shaking the phone. Only recenters an existing fix, never requests
  // location itself — useUserLocation deliberately waits for an explicit tap on non-desktop
  // instead of auto-fetching, and a jostle-triggered permission prompt would undo that
  useShakeGesture(() => {
    if (location.status === "granted" && location.position)
      mapCanvasRef.current?.centerOn(location.position);
  });

  // best-effort ask not to have the offline map cache silently evicted under storage pressure —
  // no permission prompt, browsers just grant or don't based on site engagement signals
  useEffect(() => {
    navigator.storage?.persist?.();
  }, []);

  const router = useRouter();
  const [search, setSearch] = useState("");
  // typing the secret phrase opens the admin panel, handy in the installed app where there is no
  // address bar. It still asks for the code there
  const handleSearchChange = (value: string) => {
    if (value.trim().toLowerCase() === "admin!!!") {
      triggerHaptic();
      setSearch("");
      router.push("/admin");
      return;
    }
    setSearch(value);
  };
  // which categories are on the map. null = everything (the default)
  const [shownTagIds, setShownTagIds] = useState<Set<string> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  // the drawer stays mounted once opened, so closing it can still animate out
  const [filterMounted, setFilterMounted] = useState(false);
  const [hoveredTagId, setHoveredTagId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  // About stays mounted once it has been opened, so closing it can still animate out
  const [aboutMounted, setAboutMounted] = useState(false);

  // warm the detail panel chunk once the map has painted and the browser is idle
  useEffect(() => {
    const idle =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    const handle = idle(() => void loadDetailPanel());
    return () => {
      if (window.cancelIdleCallback && typeof handle === "number")
        window.cancelIdleCallback(handle);
    };
  }, []);
  // in the url path so a place can be linked to directly: /m6l
  const [selectedId, setSelectedId] = usePinSelection(initialSelectedId);

  // dev-only live color overrides from TagColorPlayground — never populated in production, so
  // this is a no-op merge there. Keyed by tag id, applied to both the tags list (for the filter
  // pills) and each item's embedded tag (for the pins themselves)
  const [colorOverrides, setColorOverrides] = useState<
    Record<string, TagColorName>
  >({});
  // dev-only live crayon-treatment tuning from TagColorPlayground — never populated in
  // production, so pins always fall back to tagColor.ts's DEFAULT_CRAYON_TUNING there
  const [tuning, setTuning] = useState(DEFAULT_CRAYON_TUNING);
  // dev-only live pin size/label tuning from PinTuningPlayground — never populated in
  // production, so pins always fall back to MapPin's own DEFAULT_PIN_SIZE_TUNING there
  const [sizeTuning, setSizeTuning] = useState<PinSizeTuning>(
    DEFAULT_PIN_SIZE_TUNING,
  );
  const effectiveTags = tags.map((tag) =>
    colorOverrides[tag.id] ? { ...tag, color: colorOverrides[tag.id] } : tag,
  );
  const effectiveTagById = new Map(effectiveTags.map((tag) => [tag.id, tag]));
  const effectiveItems = items.map((item) => ({
    ...item,
    tag: effectiveTagById.get(item.tag.id) ?? item.tag,
  }));

  const selected =
    effectiveItems.find((item) => item.id === selectedId) ?? null;
  // what the search bar understood: the places (or group of places) to show. When nothing matched
  // the map is left alone instead of going blank, and the suggestions say so
  const coordinateSearch = parseCoordinateQuery(search) !== null;
  const outcome = searchPlaces(coordinateSearch ? "" : search, effectiveItems);
  const matchedIds = outcome.hits.length
    ? new Set(outcome.hits.map((hit) => hit.item.id))
    : null;
  const visibleItems = effectiveItems.filter(
    (item) =>
      (matchedIds === null || matchedIds.has(item.id)) &&
      (shownTagIds === null || shownTagIds.has(item.tag.id)),
  );

  // the desktop pills: picking one from "everything" shows only that one, unpicking the last one
  // goes back to everything
  const toggleTag = (tagId: string) =>
    setShownTagIds((previous) => {
      const next = new Set(previous);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next.size ? next : null;
    });
  const clearTags = () => setShownTagIds(null);

  // finds missing pins/aliases from real usage: a search term matching nothing anywhere on the
  // map (checked against the whole map, not visibleItems, so an active tag filter can't produce
  // a false "no results" for a term that's really just filtered out). Debounced so this only
  // fires once someone's paused typing, not once per keystroke
  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) return;
    const timer = setTimeout(() => {
      if (
        !parseCoordinateQuery(query) &&
        searchPlaces(query, effectiveItems).mode === "none"
      )
        recordSearchMiss(query);
    }, ZERO_RESULT_SEARCH_TRACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, effectiveItems]);

  // typing coordinates (people do) marks that spot, flies there and offers it to a maps app
  const searchedCoordinates = parseCoordinateQuery(search);
  const searchedPosition = searchedCoordinates
    ? latLongToPosition(
        searchedCoordinates.latitude,
        searchedCoordinates.longitude,
      )
    : null;
  const searchedOnCampus =
    searchedPosition !== null &&
    searchedPosition[0] > -0.03 &&
    searchedPosition[0] < 1.03 &&
    searchedPosition[1] > -0.03 &&
    searchedPosition[1] < 1.03;
  const searchedKey = searchedCoordinates
    ? `${searchedCoordinates.latitude},${searchedCoordinates.longitude}`
    : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a different place should fly the map, not every render
  useEffect(() => {
    if (!searchedPosition || !searchedOnCampus) return;
    triggerHaptic("success");
    mapCanvasRef.current?.centerOn(searchedPosition);
  }, [searchedKey]);

  // once a search narrows the map down to a single pin there's nothing left to browse, so open
  // it straight away and jump the map there too -- instead of making "which one did I mean" or
  // "where actually is that" separate steps once typing has already said so unambiguously
  useEffect(() => {
    if (!search.trim()) return;
    if (outcome.mode !== "places" || visibleItems.length !== 1) return;
    const [onlyMatch] = visibleItems;
    if (onlyMatch.id === selectedId) return;
    // a tap in the hand, so a phone user feels the jump even with the keyboard covering half the map
    triggerHaptic("success");
    setSelectedId(onlyMatch.id);
    mapCanvasRef.current?.centerOn(
      latLongToPosition(onlyMatch.latitude, onlyMatch.longitude),
    );
  }, [search, visibleItems, selectedId, setSelectedId, outcome.mode]);

  // ---- the suggestions under the search bar ----
  // only while typing: what matches, nothing more. An empty box offers nothing
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new word starts from the top of the list again
  useEffect(() => setActiveIndex(-1), [search]);

  const searchQuery = search.trim();
  const suggestionItems = outcome.hits.slice(0, 7).map((hit) => hit.item);
  const showSuggestions =
    searchFocused &&
    !coordinateSearch &&
    searchQuery.length > 0 &&
    // a single place that is already open needs no list
    !(
      outcome.mode === "places" &&
      suggestionItems.length === 1 &&
      suggestionItems[0].id === selectedId
    );

  // a mention hovered in a description: the map slides to that place and back, with a marker there
  const [previewPosition, setPreviewPosition] = useState<
    [number, number] | null
  >(null);
  function previewPlace(place: MapItem | null) {
    if (!place) {
      mapCanvasRef.current?.endPeek();
      setPreviewPosition(null);
      return;
    }
    const position = latLongToPosition(place.latitude, place.longitude);
    mapCanvasRef.current?.peekAt(position);
    setPreviewPosition(position);
  }
  // where the photo being looked at was taken, shown on the map until another place is picked
  const [photoView, setPhotoView] = useState<PhotoViewPoint | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: clears whenever the selected place changes
  useEffect(() => setPhotoView(null), [selectedId]);
  function showPhotoView(view: PhotoViewPoint) {
    setPhotoView(view);
    mapCanvasRef.current?.centerOn(
      latLongToPosition(view.latitude, view.longitude),
    );
  }
  // clicking a mention opens that place for real, and keeps the view it slid to
  function openPlace(place: MapItem) {
    mapCanvasRef.current?.commitPeek();
    setPreviewPosition(null);
    triggerHaptic("selection");
    setSelectedId(place.id);
    mapCanvasRef.current?.centerOn(
      latLongToPosition(place.latitude, place.longitude),
    );
  }

  const blurSearch = () =>
    (document.activeElement as HTMLElement | null)?.blur();
  function pickItem(item: MapItem) {
    triggerHaptic("selection");
    setSelectedId(item.id);
    mapCanvasRef.current?.centerOn(
      latLongToPosition(item.latitude, item.longitude),
    );
    setSearch("");
    blurSearch();
  }
  // arrows move through the list, Enter opens the highlighted place (or the first one)
  function handleSearchKey(key: "up" | "down" | "enter" | "escape") {
    if (key === "escape") {
      blurSearch();
      return true;
    }
    if (key === "down" || key === "up") {
      if (!suggestionItems.length) return false;
      const step = key === "down" ? 1 : -1;
      setActiveIndex(
        (i) => (i + step + suggestionItems.length) % suggestionItems.length,
      );
      return true;
    }
    const item = suggestionItems[activeIndex >= 0 ? activeIndex : 0];
    if (!searchQuery || !item) return false;
    pickItem(item);
    return true;
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
            areas={areas}
            onSelect={setSelectedId}
            userPosition={location.position}
            userAccuracy={location.accuracy}
            offCampusPosition={
              location.isOffCampus ? location.rawPosition : null
            }
            compassHeading={compass.heading}
            searchedPosition={
              searchedOnCampus ? searchedPosition : previewPosition
            }
            pickedTagIds={shownTagIds}
            photoView={photoView}
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
            onSearchChange={handleSearchChange}
            onOpenFilter={() => {
              setFilterMounted(true);
              setFilterOpen(true);
            }}
            filtered={shownTagIds !== null}
            onOpenAbout={() => {
              setAboutMounted(true);
              setAboutOpen(true);
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
              className="absolute inset-x-3 top-[4.25rem] z-40 max-h-[min(26rem,calc(100dvh-7rem))] sm:inset-x-auto sm:top-[3.75rem] sm:right-3 sm:w-96"
              query={search}
              items={suggestionItems}
              activeIndex={activeIndex}
              onPick={pickItem}
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
                places={effectiveItems}
                onOpenPlace={openPlace}
                onPreviewPlace={previewPlace}
                onShowPhotoView={showPhotoView}
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
            activeTagIds={shownTagIds ?? new Set()}
            {...{ hoveredTagId }}
          />
          {filterMounted && (
            <FilterDrawer
              open={filterOpen}
              onOpenChange={setFilterOpen}
              tags={effectiveTags}
              shownTagIds={shownTagIds}
              onChange={setShownTagIds}
            />
          )}
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
  );
}
