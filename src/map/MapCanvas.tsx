"use client";

import { m, useMotionValueEvent } from "motion/react";
import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { preload } from "react-dom";
import { Icon } from "@/components/Icon";
import { SquircleFuserContainer } from "@/components/SquircleFuser";
import { ICONS } from "@/icons";
import { cn } from "@/shadcn/utils";
import { copyToClipboard } from "@/utils/clipboard";
import { triggerHaptic } from "@/utils/haptics";
import { useCopyFeedback } from "@/utils/useCopyFeedback";
import {
  formatCoordinates,
  type NormalizedPosition,
  positionToLatLong,
  positionToStyle,
  screenPointToPosition,
  latLongToPosition,
} from "./geo";
import {
  DEFAULT_PIN_SIZE_TUNING,
  MapPin,
  PIN_TIP_FRACTION,
  type PinSizeTuning,
} from "./MapPin";
import { AreaLabels, singlePlaceBlocks } from "./AreaLabels";
import type { Area } from "./areas";
import { OffCampusIndicator } from "./OffCampusIndicator";
import type { CrayonTuning } from "./tagColor";
import type { MapItem, PhotoViewPoint } from "./types";
import { type UserLocation, UserLocationMarker } from "./UserLocationMarker";
import { pinCounterScale, useMapPanZoom } from "./useMapPanZoom";

// hoisted into <head> by react during render, so the download starts before the image element
// even mounts. The browser picks AVIF when it can, and this hint matches that choice
function preloadMapImage() {
  preload("/campus-map.svg", {
    as: "image",
    type: "image/svg+xml",
    fetchPriority: "high",
  });
  preload("/auimap-640.avif", {
    as: "image",
    type: "image/avif",
    fetchPriority: "high",
  });
}

const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const SURVEYED_COORD_TOAST_MS = 3000;
const COPIED_FEEDBACK_MS = 1500;

// a tiny, heavily blurred copy of the map, inlined so it paints instantly with zero network
// cost — shown until the real (still much lighter, post-crop) image finishes loading, so first
// paint isn't blocked on it
const MAP_IMAGE_PLACEHOLDER =
  "data:image/webp;base64,UklGRuwAAABXRUJQVlA4IOAAAACQBgCdASocABwAPuleqE2pJSQiN/VYASAdCWMArDNDDj01wIQbHO7NrlrkXHtPrgvbXVQYAa9AYGdu74jgAP7uhUz/AWWkUW9SqKuJeTe9iHWwNySMJG8PfzG/dMaRQ+Fs9LT8ubyqdt1yTwRfFBWuj8qvT7S6GdN0WzQsDNA6TZ1LhmwMACA3b64ZCtoftWMMw++qu1UlV7hUg0HmWNZ+75Jkd44lJfjKaJX4iWIyo9pomiWf8bQLM8oFhAwABh8Ev2yQoP5GV1CkmKxfOerPN0Kk8avrYCzuNnqLODQAAA==";

// a marker for wherever the map's context menu was opened — never a real place, just a way to
// see exactly which point the menu's coordinates/directions refer to
function DroppedPinMarker({
  position,
  strong,
}: {
  position: NormalizedPosition;
  // a place someone searched for by coordinates: in the brand colour and fully visible, instead of
  // the faint cue used for a right click
  strong?: boolean;
}) {
  // white rather than one of the tag colors, and half-see-through — this isn't a real place, just
  // a faint "you clicked here" cue, so it shouldn't compete with the actual pins around it
  const fill = strong ? "var(--primary)" : "white";
  const outline = "white";
  const glow = strong ? "var(--primary)" : "white";

  return (
    <div
      className={cn(
        "pointer-events-none absolute",
        strong ? "z-[900]" : "opacity-25",
      )}
      style={{
        ...positionToStyle(position),
        transform: `translate(-50%, ${-PIN_TIP_FRACTION * 100}%)`,
      }}
    >
      <span
        className="absolute left-1/2 size-5 -translate-1/2 rounded-full opacity-60 motion-safe:animate-ping"
        style={{ backgroundColor: glow, top: `${(11 / 24) * 100}%` }}
      />
      <Icon
        icon={ICONS.pin}
        {...{ fill }}
        strokeWidth={1.8}
        style={{ color: outline, filter: `drop-shadow(0 0 6px ${glow})` }}
        className="relative block size-7"
      />
    </div>
  );
}

// where a photo was taken: a blue dot with a wedge showing which way the camera faced
function PhotoViewMarker({ view }: { view: PhotoViewPoint }) {
  const position = latLongToPosition(view.latitude, view.longitude);
  return (
    <div
      className="pointer-events-none absolute z-[900]"
      style={{
        ...positionToStyle(position),
        transform: "translate(-50%, -50%) scale(var(--pin-counter-scale))",
      }}
    >
      <svg
        width="170"
        height="170"
        viewBox="-85 -85 170 170"
        className="block overflow-visible"
      >
        <title>Where the photo was taken</title>
        {view.heading !== null && (
          <g transform={`rotate(${view.heading})`}>
            <defs>
              <radialGradient
                id="photoViewGlow"
                cx="0"
                cy="0"
                r="78"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0" stopColor="#2563eb" stopOpacity="0.9" />
                <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              d="M0 0L-40 -67A78 78 0 0 1 40 -67Z"
              fill="url(#photoViewGlow)"
            />
          </g>
        )}
        <circle r="9" fill="#2563eb" stroke="#fff" strokeWidth="3.5" />
      </svg>
    </div>
  );
}

const LONG_PRESS_MS = 600;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
const MENU_WIDTH_PX = 208;
const MENU_HEIGHT_PX = 4 * 36 + 8;

// no menu library on purpose: Radix's context menu (plus its popper/focus-scope) was in the first
// load for something used once in a while. This is a plain fixed-position list that closes on
// outside press, Escape or scroll
function DroppedPinMenu({
  position,
  point,
  onClose,
}: {
  position: NormalizedPosition;
  point: { x: number; y: number };
  onClose: () => void;
}) {
  const { latitude, longitude } = positionToLatLong(position);
  const coordinates = `${latitude},${longitude}`;
  const { copied, copy } = useCopyFeedback(COPIED_FEEDBACK_MS);
  const menuRef = useRef<HTMLDivElement>(null);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates}`;
  const appleMapsUrl = `https://maps.apple.com/?ll=${coordinates}`;
  const wazeUrl = `https://waze.com/ul?ll=${coordinates}&navigate=yes`;

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", closeOnOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside, true);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  function openMapsUrl(url: string) {
    triggerHaptic();
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  function copyCoordinates() {
    triggerHaptic();
    copy(formatCoordinates({ latitude, longitude }));
  }

  const items = [
    {
      icon: copied ? ICONS.copied : ICONS.copy,
      label: copied ? "Copied!" : "Copy coordinates",
      onSelect: copyCoordinates,
    },
    {
      icon: ICONS.openExternalMap,
      label: "Open in Google Maps",
      onSelect: () => openMapsUrl(googleMapsUrl),
    },
    {
      icon: ICONS.openExternalMap,
      label: "Open in Apple Maps",
      onSelect: () => openMapsUrl(appleMapsUrl),
    },
    {
      icon: ICONS.openExternalMap,
      label: "Open in Waze",
      onSelect: () => openMapsUrl(wazeUrl),
    },
  ];

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{
        left: Math.max(
          8,
          Math.min(point.x, window.innerWidth - MENU_WIDTH_PX - 8),
        ),
        top: Math.max(
          8,
          Math.min(point.y, window.innerHeight - MENU_HEIGHT_PX - 8),
        ),
        width: MENU_WIDTH_PX,
      }}
      className="fixed z-50 rounded-lg bg-popover/80 p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 backdrop-blur-2xl"
    >
      {items.map(({ icon, label, onSelect }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onClick={onSelect}
          className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-none"
        >
          <Icon icon={icon} />
          {label}
        </button>
      ))}
    </div>
  );
}

export type MapCanvasHandle = {
  // an explicit recenter — unlike the one-time auto-center on first fix, this ignores whether
  // the user has already panned around, since clicking a "center me" button is unambiguous
  // intent to jump back to their position
  centerOn: (position: [number, number]) => void;
  // slide to a place and back again, see useMapPanZoom
  peekAt: (position: [number, number]) => void;
  endPeek: () => void;
  commitPeek: () => void;
};

export function MapCanvas({
  items,
  areas = [],
  selectedId,
  onSelect,
  userPosition,
  userAccuracy,
  offCampusPosition,
  compassHeading,
  hoveredTagId,
  pickedTagIds = null,
  photoView = null,
  searchedPosition,
  tuning,
  sizeTuning = DEFAULT_PIN_SIZE_TUNING,
  ref,
}: {
  items: MapItem[];
  // the buildings and areas, so one with a single place can be painted in its colour with its name
  areas?: Area[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  userPosition: UserLocation["position"];
  userAccuracy: UserLocation["accuracy"];
  offCampusPosition: UserLocation["rawPosition"];
  compassHeading: number | null;
  hoveredTagId: string | null;
  // categories picked on their own in the filter. Their tiny pins show at any zoom
  pickedTagIds?: Set<string> | null;
  // where the photo being looked at was taken, with the way the camera faced
  photoView?: PhotoViewPoint | null;
  // where a coordinates search points, drawn as a marker until the search is cleared
  searchedPosition?: NormalizedPosition | null;
  // only ever overridden by the dev-only TagColorPlayground — real visitors always get the default
  tuning?: CrayonTuning;
  // only ever overridden by the dev-only PinTuningPlayground — real visitors always get the default
  sizeTuning?: PinSizeTuning;
  ref?: React.Ref<MapCanvasHandle>;
}) {
  preloadMapImage();
  const panZoom = useMapPanZoom();
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const [surveyedCoord, setSurveyedCoord] = useState<string | null>(null);
  const surveyedCoordTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [contextMenu, setContextMenu] = useState<{
    position: NormalizedPosition;
    point: { x: number; y: number };
  } | null>(null);
  const contextMenuPosition = contextMenu?.position ?? null;
  const longPress = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const [lowLoaded, setLowLoaded] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);

  // growthExponent and labelShowScale are the same for every pin (only ever overridden app-wide
  // by the dev-only PinTuningPlayground, never per-item), so they're computed once here. The
  // counter-scale goes out as one css variable on the image box that every pin reads, so a zoom
  // frame is a single style write instead of one per pin. The initial value is frozen in state:
  // react only rewrites the style prop when its value changes, so it never fights the imperative
  // updates below
  const [initialPinCounterScale] = useState(() =>
    pinCounterScale(panZoom.scale.get(), sizeTuning.growthExponent),
  );
  useMotionValueEvent(panZoom.scale, "change", (scale) => {
    imageBoxRef.current?.style.setProperty(
      "--pin-counter-scale",
      String(pinCounterScale(scale, sizeTuning.growthExponent)),
    );
  });
  const [showPinLabels, setShowPinLabels] = useState(
    () => panZoom.scale.get() > sizeTuning.labelShowScale,
  );
  useMotionValueEvent(panZoom.scale, "change", (scale) => {
    const next = scale > sizeTuning.labelShowScale;
    setShowPinLabels((current) => (current === next ? current : next));
  });
  // small details (a bathroom, a printer) only appear once the map is zoomed in far enough. Tracked
  // in quarter steps so zooming doesn't re-render the map on every frame
  const [zoomStep, setZoomStep] = useState(
    () => Math.floor(panZoom.scale.get() * 4) / 4,
  );
  useMotionValueEvent(panZoom.scale, "change", (scale) => {
    const next = Math.floor(scale * 4) / 4;
    setZoomStep((current) => (current === next ? current : next));
  });

  // the width of the map box on screen at zoom 1, to know how big a name would be written
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const el = imageBoxRef.current;
    if (!el) return;
    const measure = () => setBoxWidth(el.offsetWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const visibleItems = items.filter(
    (item) =>
      item.minZoom == null ||
      zoomStep >= item.minZoom ||
      item.id === selectedId ||
      pickedTagIds?.has(item.tag.id),
  );
  const blocks = singlePlaceBlocks(
    areas,
    visibleItems,
    (boxWidth * zoomStep) / 1312,
  );
  const blockIds = new Set(blocks.map((block) => block.item.id));

  useImperativeHandle(
    ref,
    () => ({
      centerOn: panZoom.centerOn,
      peekAt: panZoom.peekAt,
      endPeek: panZoom.endPeek,
      commitPeek: panZoom.commitPeek,
    }),
    [panZoom.centerOn, panZoom.peekAt, panZoom.endPeek, panZoom.commitPeek],
  );

  useEffect(() => () => clearTimeout(surveyedCoordTimer.current), []);

  // toggled imperatively instead of through React state, so dropping the selected pin's glow
  // filter mid-gesture doesn't itself cost a render — see useMapPanZoom's isMoving for why
  useMotionValueEvent(panZoom.isMoving, "change", (value) => {
    imageBoxRef.current?.toggleAttribute("data-moving", value === 1);
  });

  // the moment the user's location is first found, zoom in and center on them — but only if
  // they haven't touched the map yet themselves, and only ever this once. Later position updates
  // from the same watchPosition (useUserLocation) must not keep yanking the view back to them
  const hasAutoLocated = useRef(false);
  useEffect(() => {
    if (!userPosition || hasAutoLocated.current) return;
    hasAutoLocated.current = true;
    if (!panZoom.hasInteracted.current) panZoom.centerOn(userPosition);
  }, [userPosition, panZoom]);

  // ctrl/cmd + click reads the coordinate under the cursor and copies it in data.ts's format, so
  // new map items can be surveyed straight off the satellite image
  async function copyCoordinateUnderCursor(event: React.MouseEvent) {
    const imageBox = imageBoxRef.current?.getBoundingClientRect();
    if (!event.ctrlKey && !event.metaKey) return;
    if (!imageBox) return;

    const clicked = screenPointToPosition(
      { x: event.clientX, y: event.clientY },
      imageBox,
    );
    const coord = formatCoordinates(positionToLatLong(clicked));

    const succeeded = await copyToClipboard(coord);
    if (!succeeded) {
      triggerHaptic("error");
      return;
    }
    triggerHaptic("success");
    setSurveyedCoord(coord);

    // restarts on every survey, so copying twice in a row doesn't inherit the first countdown
    clearTimeout(surveyedCoordTimer.current);
    surveyedCoordTimer.current = setTimeout(
      () => setSurveyedCoord(null),
      SURVEYED_COORD_TOAST_MS,
    );
  }

  // right-click (desktop, Android long-press) or a 600ms touch long-press (iOS fires no
  // contextmenu event) drops a marker and opens a menu of things to do with that spot
  function openContextMenuAt(clientX: number, clientY: number) {
    const imageBox = imageBoxRef.current?.getBoundingClientRect();
    if (!imageBox) return;
    setContextMenu({
      position: screenPointToPosition({ x: clientX, y: clientY }, imageBox),
      point: { x: clientX, y: clientY },
    });
  }

  function cancelLongPress() {
    if (longPress.current) clearTimeout(longPress.current.timer);
    longPress.current = null;
  }

  function startLongPress(event: React.PointerEvent) {
    if (event.pointerType !== "touch") return;
    cancelLongPress();
    const { clientX, clientY } = event;
    longPress.current = {
      x: clientX,
      y: clientY,
      timer: setTimeout(() => {
        longPress.current = null;
        triggerHaptic();
        openContextMenuAt(clientX, clientY);
      }, LONG_PRESS_MS),
    };
  }

  function moveLongPress(event: React.PointerEvent) {
    const pending = longPress.current;
    if (!pending) return;
    if (
      Math.hypot(event.clientX - pending.x, event.clientY - pending.y) >
      LONG_PRESS_MOVE_TOLERANCE_PX
    )
      cancelLongPress();
  }

  return (
    <>
      <div
        ref={panZoom.containerRef}
        {...panZoom.gestureHandlers}
        onPointerDownCapture={startLongPress}
        onPointerMoveCapture={moveLongPress}
        onPointerUpCapture={cancelLongPress}
        onPointerCancelCapture={cancelLongPress}
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenuAt(event.clientX, event.clientY);
        }}
        onClick={copyCoordinateUnderCursor}
        style={{ touchAction: "none" }}
        className={cn(
          // isolate boxes in every z-index inside (selected pins go to 1000) so they only ever
          // stack against each other, never against sibling UI chrome (top bar, brand, panel).
          // That containment would otherwise come for free from the transform on the motion.div
          // below -- a non-"none" transform creates a stacking context too -- except framer
          // hasn't written that transform to the DOM yet on the very first frame(s), so pins
          // could briefly out-rank the chrome around them until it does. isolate doesn't wait.
          "absolute inset-0 isolate select-none overflow-hidden bg-background transition-[box-shadow]",
          panZoom.hitLimit && "shadow-[inset_0_0_0_4px_rgba(220,38,38,0.45)]",
        )}
      >
        <m.div
          className="absolute inset-0 flex items-center justify-center [container-type:size]"
          style={{ scale: panZoom.scale, x: panZoom.x, y: panZoom.y }}
        >
          {/* the image is square while the viewport isn't, so anything placed against the viewport
            box would drift as the image gets cropped to cover it. This square box covers the
            viewport and becomes the one coordinate space the image and every marker agree on.
            Its side is the viewport's longer edge — asking for a square via min-width AND
            min-height instead lets a portrait phone win both, which stretches the image */}
          <div
            ref={imageBoxRef}
            className="relative size-[100cqmax] shrink-0"
            style={
              {
                "--pin-counter-scale": initialPinCounterScale,
              } as React.CSSProperties
            }
          >
            {/* shown until the real image below finishes loading, so first paint never waits
              on it */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-500",
                lowLoaded ? "opacity-0" : "opacity-100",
              )}
              style={{ backgroundImage: `url(${MAP_IMAGE_PLACEHOLDER})` }}
            />
            {/* unoptimized on purpose: the optimizer would hand back a copy sized to the viewport,
              which is exactly the detail zooming needs. This file is already a tuned webp.
              Stays invisible until fully decoded (crossfading with the blurred placeholder above)
              -- otherwise the browser paints whatever's streamed in so far on a slow connection,
              which for a big image shows as scanline-y decode garbage instead of a clean reveal */}
            {/* the hand drawn campus (buildings, roads, paths), 6KB. It paints with the first response,
              long before any photo, and follows light / dark mode by itself. The photos fade in over it */}
            {/* biome-ignore lint/performance/noImgElement: a tiny static svg, next/image adds nothing */}
            <img
              src="/campus-map.svg"
              alt=""
              aria-hidden
              fetchPriority="high"
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full object-cover"
            />
            {/* four layers, each over the last: the inlined blur, the svg above, a 36KB 640px AVIF
              that lands almost at once, then the full 168KB one. The full one only starts once the
              small one has arrived (it's mounted by lowLoaded), so the two never fight for
              bandwidth. Plain <img>s inside <picture> instead of next/image: its priority preload
              would also fetch the webp fallback, so the small AVIF is preloaded by hand. Browsers
              without AVIF get a 1px stand-in for the small layer and go straight to the webp.
              Each layer stays invisible until fully decoded, otherwise a slow connection paints
              scanline-y half-decoded garbage instead of a clean reveal */}
            <picture>
              <source type="image/avif" srcSet="/auimap-640.avif" />
              <img
                src={BLANK_PIXEL}
                alt=""
                aria-hidden
                fetchPriority="high"
                decoding="async"
                draggable={false}
                onLoad={() => setLowLoaded(true)}
                // a cached image can finish loading before hydration, and that onLoad is then
                // never replayed, which left the blurred placeholder up for good
                ref={(image) => {
                  if (image?.complete) setLowLoaded(true);
                }}
                className={cn(
                  "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-300",
                  lowLoaded ? "opacity-100" : "opacity-0",
                )}
              />
            </picture>
            {lowLoaded && (
              <picture>
                <source type="image/avif" srcSet="/auimap-1312.avif" />
                <img
                  src="/auimap-1312.webp"
                  alt="Campus map"
                  decoding="async"
                  draggable={false}
                  onLoad={() => setFullLoaded(true)}
                  ref={(image) => {
                    if (image?.complete) setFullLoaded(true);
                  }}
                  className={cn(
                    "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-500",
                    fullLoaded ? "opacity-100" : "opacity-0",
                  )}
                />
              </picture>
            )}
            <UserLocationMarker
              position={userPosition}
              heading={compassHeading}
              accuracy={userAccuracy}
            />
            {offCampusPosition && (
              <OffCampusIndicator position={offCampusPosition} />
            )}
            {blocks.length > 0 && (
              <AreaLabels
                {...{ blocks, selectedId, tuning }}
                previewTagId={hoveredTagId}
                onSelect={onSelect}
              />
            )}
            {visibleItems
              .filter(
                (item) => !blockIds.has(item.id) || item.id === selectedId,
              )
              .map((item) => (
                <MapPin
                  key={item.id}
                  selected={item.id === selectedId}
                  showLabel={showPinLabels}
                  onSelect={() =>
                    onSelect(item.id === selectedId ? null : item.id)
                  }
                  previewing={hoveredTagId !== null}
                  matchesPreview={item.tag.id === hoveredTagId}
                  {...{ item, tuning, sizeTuning }}
                />
              ))}
            {contextMenuPosition && (
              <DroppedPinMarker position={contextMenuPosition} />
            )}
            {photoView && <PhotoViewMarker view={photoView} />}
            {searchedPosition && (
              <DroppedPinMarker position={searchedPosition} strong />
            )}
          </div>
        </m.div>

        {/* recesses the map behind the border and the squircle containers floating above it.
          color comes from --map-vignette (theme-aware) rather than a flat black, so this doesn't
          read as a hard dark ring against the containers' bg-background fusers in light mode */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_32px_8px_var(--color-map-vignette)]"
        />

        {surveyedCoord && (
          <SquircleFuserContainer
            align="bottom-left"
            superClassName="absolute bottom-0 left-0"
            className="gap-2 text-sm"
          >
            <Icon icon={ICONS.copy} className="text-muted-foreground" />
            <span className="font-mono">{surveyedCoord}</span>
          </SquircleFuserContainer>
        )}
      </div>
      {contextMenu && (
        <DroppedPinMenu {...contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </>
  );
}
