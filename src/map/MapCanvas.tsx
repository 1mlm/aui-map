"use client"

import { motion, useMotionValueEvent } from "motion/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { SquircleFuserContainer } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import {
  formatCoordinates,
  type NormalizedPosition,
  positionToLatLong,
  positionToStyle,
  screenPointToPosition,
} from "./geo"
import { MapPin, PIN_TIP_FRACTION, PinInnerShadowFilter } from "./MapPin"
import { tagPinFillColor, tagPinOutlineColor, tagSolidColor } from "./tagColor"
import type { MapItem } from "./types"
import { type UserLocation, UserLocationMarker } from "./UserLocationMarker"
import { useMapPanZoom } from "./useMapPanZoom"

const SURVEYED_COORD_TOAST_MS = 3000
const COPIED_FEEDBACK_MS = 1500

// a marker for wherever the map's context menu was opened — never a real place, just a way to
// see exactly which point the menu's coordinates/directions refer to
function DroppedPinMarker({ position }: { position: NormalizedPosition }) {
  const fill = tagPinFillColor("red")
  const outline = tagPinOutlineColor("red")
  const glow = tagSolidColor("red")

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        ...positionToStyle(position),
        transform: `translate(-50%, ${-PIN_TIP_FRACTION * 100}%)`,
      }}
    >
      <span
        className="absolute left-1/2 size-5 -translate-1/2 animate-ping rounded-full opacity-60"
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
  const [copied, setCopied] = useState(false)

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${coordinates}`
  const appleMapsUrl = `https://maps.apple.com/?ll=${coordinates}`
  const wazeUrl = `https://waze.com/ul?ll=${coordinates}&navigate=yes`

  function openMapsUrl(url: string) {
    triggerHaptic()
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function copyCoordinates() {
    triggerHaptic()
    navigator.clipboard.writeText(formatCoordinates({ latitude, longitude }))
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
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
      <ContextMenuSeparator />
      <ContextMenuItem asChild onSelect={() => triggerHaptic()}>
        <a
          href="/auimap.webp"
          download="aui-campus-map.webp"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon icon={ICONS.upload} className="rotate-180" />
          Download background map image
        </a>
      </ContextMenuItem>
    </>
  )
}

export function MapCanvas({
  items,
  selectedId,
  onSelect,
  userPosition,
  hoveredTagId,
}: {
  items: MapItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  userPosition: UserLocation["position"]
  hoveredTagId: string | null
}) {
  const panZoom = useMapPanZoom()
  const imageBoxRef = useRef<HTMLDivElement>(null)
  const [surveyedCoord, setSurveyedCoord] = useState<string | null>(null)
  const surveyedCoordTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [contextMenuPosition, setContextMenuPosition] =
    useState<NormalizedPosition | null>(null)

  useEffect(() => () => clearTimeout(surveyedCoordTimer.current), [])

  // toggled imperatively instead of through React state, so 69 pins dropping their shadow
  // filters mid-gesture doesn't itself cost a render — see useMapPanZoom's isMoving for why
  useMotionValueEvent(panZoom.isMoving, "change", (value) => {
    imageBoxRef.current?.toggleAttribute("data-moving", value === 1)
  })

  // ctrl/cmd + click reads the coordinate under the cursor and copies it in data.ts's format, so
  // new map items can be surveyed straight off the satellite image
  function copyCoordinateUnderCursor(event: React.MouseEvent) {
    const imageBox = imageBoxRef.current?.getBoundingClientRect()
    if (!event.ctrlKey && !event.metaKey) return
    if (!imageBox) return

    const clicked = screenPointToPosition(
      { x: event.clientX, y: event.clientY },
      imageBox,
    )
    const coord = formatCoordinates(positionToLatLong(clicked))

    navigator.clipboard.writeText(coord)
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
              {/* unoptimized on purpose: the optimizer would hand back a copy sized to the viewport,
              which is exactly the detail zooming needs. This file is already a tuned webp */}
              <Image
                src="/auimap.webp"
                alt="Campus map"
                fill
                priority
                unoptimized
                draggable={false}
                className="pointer-events-none"
              />
              <UserLocationMarker position={userPosition} />
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
                  {...{ item }}
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

          <PinInnerShadowFilter />
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
