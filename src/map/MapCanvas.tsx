"use client"

import { motion, useMotionValueEvent } from "motion/react"
import Image from "next/image"
import { useEffect, useImperativeHandle, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu"
import { cn } from "@/shadcn/utils"
import { copyToClipboard } from "@/utils/clipboard"
import { triggerHaptic } from "@/utils/haptics"
import { isImageMimeType } from "@/utils/mimeType"
import { useCopyFeedback } from "@/utils/useCopyFeedback"
import {
  formatCoordinates,
  type NormalizedPosition,
  positionToLatLong,
  positionToStyle,
  screenPointToPosition,
} from "./geo"
import { MapPin, PIN_TIP_FRACTION, type PinSizeTuning } from "./MapPin"
import { OffCampusIndicator } from "./OffCampusIndicator"
import type { CrayonTuning } from "./tagColor"
import type { MapItem } from "./types"
import { type UserLocation, UserLocationMarker } from "./UserLocationMarker"
import type { CompassPermission } from "./useCompassHeading"
import { useMapPanZoom } from "./useMapPanZoom"

const SURVEYED_COORD_TOAST_MS = 3000
const COPIED_FEEDBACK_MS = 1500

// a tiny, heavily blurred copy of the map, inlined so it paints instantly with zero network
// cost — shown until the real (still much lighter, post-crop) image finishes loading, so first
// paint isn't blocked on it
const MAP_IMAGE_PLACEHOLDER =
  "data:image/webp;base64,UklGRuwAAABXRUJQVlA4IOAAAACQBgCdASocABwAPuleqE2pJSQiN/VYASAdCWMArDNDDj01wIQbHO7NrlrkXHtPrgvbXVQYAa9AYGdu74jgAP7uhUz/AWWkUW9SqKuJeTe9iHWwNySMJG8PfzG/dMaRQ+Fs9LT8ubyqdt1yTwRfFBWuj8qvT7S6GdN0WzQsDNA6TZ1LhmwMACA3b64ZCtoftWMMw++qu1UlV7hUg0HmWNZ+75Jkd44lJfjKaJX4iWIyo9pomiWf8bQLM8oFhAwABh8Ev2yQoP5GV1CkmKxfOerPN0Kk8avrYCzuNnqLODQAAA=="

// a marker for wherever the map's context menu was opened — never a real place, just a way to
// see exactly which point the menu's coordinates/directions refer to
function DroppedPinMarker({ position }: { position: NormalizedPosition }) {
  // white rather than one of the tag colors, and half-see-through — this isn't a real place, just
  // a faint "you clicked here" cue, so it shouldn't compete with the actual pins around it
  const fill = "white"
  const outline = "white"
  const glow = "white"

  return (
    <div
      className="pointer-events-none absolute opacity-25"
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
  )
}

function DroppedPinMenuContent({ position }: { position: NormalizedPosition }) {
  const { latitude, longitude } = positionToLatLong(position)
  const coordinates = `${latitude},${longitude}`
  const { copied, copy } = useCopyFeedback(COPIED_FEEDBACK_MS)

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates}`
  const appleMapsUrl = `https://maps.apple.com/?ll=${coordinates}`
  const wazeUrl = `https://waze.com/ul?ll=${coordinates}&navigate=yes`

  function openMapsUrl(url: string) {
    triggerHaptic()
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function copyCoordinates() {
    triggerHaptic()
    copy(formatCoordinates({ latitude, longitude }))
  }

  return (
    <>
      <ContextMenuItem onSelect={copyCoordinates}>
        <Icon icon={copied ? ICONS.copied : ICONS.copy} />
        {copied ? "Copied!" : "Copy coordinates"}
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => openMapsUrl(googleMapsUrl)}>
        <Icon icon={ICONS.openExternalMap} />
        Open in Google Maps
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => openMapsUrl(appleMapsUrl)}>
        <Icon icon={ICONS.openExternalMap} />
        Open in Apple Maps
      </ContextMenuItem>
      <ContextMenuItem onSelect={() => openMapsUrl(wazeUrl)}>
        <Icon icon={ICONS.openExternalMap} />
        Open in Waze
      </ContextMenuItem>
    </>
  )
}

export type MapCanvasHandle = {
  // an explicit recenter — unlike the one-time auto-center on first fix, this ignores whether
  // the user has already panned around, since clicking a "center me" button is unambiguous
  // intent to jump back to their position
  centerOn: (position: [number, number]) => void
}

export function MapCanvas({
  items,
  selectedId,
  onSelect,
  userPosition,
  offCampusPosition,
  compassHeading,
  compassPermission,
  onRequestCompass,
  hoveredTagId,
  tuning,
  sizeTuning,
  ref,
}: {
  items: MapItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  userPosition: UserLocation["position"]
  offCampusPosition: UserLocation["rawPosition"]
  compassHeading: number | null
  compassPermission: CompassPermission
  onRequestCompass: () => void
  hoveredTagId: string | null
  // only ever overridden by the dev-only TagColorPlayground — real visitors always get the default
  tuning?: CrayonTuning
  // only ever overridden by the dev-only PinTuningPlayground — real visitors always get the default
  sizeTuning?: PinSizeTuning
  ref?: React.Ref<MapCanvasHandle>
}) {
  const panZoom = useMapPanZoom()
  const imageBoxRef = useRef<HTMLDivElement>(null)
  const [surveyedCoord, setSurveyedCoord] = useState<string | null>(null)
  const surveyedCoordTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [contextMenuPosition, setContextMenuPosition] =
    useState<NormalizedPosition | null>(null)
  const [mapImageLoaded, setMapImageLoaded] = useState(false)

  useImperativeHandle(ref, () => ({ centerOn: panZoom.centerOn }), [
    panZoom.centerOn,
  ])

  useEffect(() => () => clearTimeout(surveyedCoordTimer.current), [])

  // requests every pin's photos once, up front, so the service worker's image cache has them
  // before anyone goes offline — not just the ones they happened to open first. Plain <img>-style
  // requests are enough; the cache is populated by the fetch itself, this component never reads
  // the result
  useEffect(() => {
    for (const item of items) {
      for (const attachment of item.attachments) {
        if (!isImageMimeType(attachment.mimeType)) continue
        new window.Image().src = attachment.url
      }
    }
  }, [items])

  // toggled imperatively instead of through React state, so dropping the selected pin's glow
  // filter mid-gesture doesn't itself cost a render — see useMapPanZoom's isMoving for why
  useMotionValueEvent(panZoom.isMoving, "change", (value) => {
    imageBoxRef.current?.toggleAttribute("data-moving", value === 1)
  })

  // the moment the user's location is first found, zoom in and center on them — but only if
  // they haven't touched the map yet themselves, and only ever this once. Later position updates
  // from the same watchPosition (useUserLocation) must not keep yanking the view back to them
  const hasAutoLocated = useRef(false)
  useEffect(() => {
    if (!userPosition || hasAutoLocated.current) return
    hasAutoLocated.current = true
    if (!panZoom.hasInteracted.current) panZoom.centerOn(userPosition)
  }, [userPosition, panZoom])

  // ctrl/cmd + click reads the coordinate under the cursor and copies it in data.ts's format, so
  // new map items can be surveyed straight off the satellite image
  async function copyCoordinateUnderCursor(event: React.MouseEvent) {
    const imageBox = imageBoxRef.current?.getBoundingClientRect()
    if (!event.ctrlKey && !event.metaKey) return
    if (!imageBox) return

    const clicked = screenPointToPosition(
      { x: event.clientX, y: event.clientY },
      imageBox,
    )
    const coord = formatCoordinates(positionToLatLong(clicked))

    const succeeded = await copyToClipboard(coord)
    if (!succeeded) {
      triggerHaptic("error")
      return
    }
    triggerHaptic("success")
    setSurveyedCoord(coord)

    // restarts on every survey, so copying twice in a row doesn't inherit the first countdown
    clearTimeout(surveyedCoordTimer.current)
    surveyedCoordTimer.current = setTimeout(
      () => setSurveyedCoord(null),
      SURVEYED_COORD_TOAST_MS,
    )
  }

  // right-click (desktop) or long-press (touch, handled by radix itself) drops a marker and opens
  // a menu of things to do with that spot. Radix doesn't hand back the triggering coordinate, so
  // it's read off panZoom's own pointer tracking instead, at the moment the menu actually opens
  function handleContextMenuOpenChange(open: boolean) {
    if (!open) {
      setContextMenuPosition(null)
      return
    }
    const imageBox = imageBoxRef.current?.getBoundingClientRect()
    if (!imageBox) return
    setContextMenuPosition(
      screenPointToPosition(panZoom.getLastPointerClientPosition(), imageBox),
    )
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuOpenChange}>
      <ContextMenuTrigger asChild>
        <div
          ref={panZoom.containerRef}
          {...panZoom.gestureHandlers}
          onClick={copyCoordinateUnderCursor}
          style={{ touchAction: "none" }}
          className={cn(
            "absolute inset-0 select-none overflow-hidden bg-background transition-[box-shadow]",
            panZoom.hitLimit && "shadow-[inset_0_0_0_4px_rgba(220,38,38,0.45)]",
          )}
        >
          <motion.div
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
            >
              {/* shown until the real image below finishes loading, so first paint never waits
              on it */}
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 bg-cover bg-center transition-opacity duration-500",
                  mapImageLoaded ? "opacity-0" : "opacity-100",
                )}
                style={{ backgroundImage: `url(${MAP_IMAGE_PLACEHOLDER})` }}
              />
              {/* unoptimized on purpose: the optimizer would hand back a copy sized to the viewport,
              which is exactly the detail zooming needs. This file is already a tuned webp */}
              <Image
                src="/auimap-1312.webp"
                alt="Campus map"
                fill
                priority
                unoptimized
                draggable={false}
                onLoad={() => setMapImageLoaded(true)}
                className="pointer-events-none"
              />
              <UserLocationMarker
                position={userPosition}
                heading={compassHeading}
                compassPermission={compassPermission}
                onRequestCompass={onRequestCompass}
              />
              {offCampusPosition && (
                <OffCampusIndicator position={offCampusPosition} />
              )}
              {items.map((item) => (
                <MapPin
                  key={item.id}
                  selected={item.id === selectedId}
                  viewportScale={panZoom.scale}
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
            </div>
          </motion.div>

          {/* recesses the map behind the border and the squircle containers floating above it */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 shadow-[inset_0_0_32px_8px_rgba(0,0,0,0.55)]"
          />

          {surveyedCoord && (
            <SquircleFuserContainer
              align="bottom-center"
              superClassName="absolute bottom-0 left-1/2 -translate-x-1/2"
              className="gap-2 text-sm"
            >
              <Icon icon={ICONS.copy} className="text-muted-foreground" />
              <span className="font-mono">{surveyedCoord}</span>
            </SquircleFuserContainer>
          )}
        </div>
      </ContextMenuTrigger>
      {contextMenuPosition && (
        <ContextMenuContent>
          <DroppedPinMenuContent position={contextMenuPosition} />
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
}
