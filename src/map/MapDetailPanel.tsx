"use client"

import { motion, type PanInfo } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { fuserOverlapClass, SquircleFuser } from "@/components/SquircleFuser"
import { DateCell } from "@/components/table/CustomTableCell"
import { ICONS } from "@/icons"
import { Button } from "@/shadcn/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shadcn/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { isImageMimeType } from "@/utils/mimeType"
import { useCopyFeedback } from "@/utils/useCopyFeedback"
import { AttachmentCarousel, AttachmentStrip } from "./AttachmentCarousel"
import { ContributeMenu } from "./ContributeMenu"
import { formatCoordinates } from "./geo"
import { TagChipIcon, tagChipClassName } from "./MapTagFilter"
import { ShareMenu } from "./ShareMenu"
import { tagColorStyle } from "./tagColor"
import type { MapItem, MapItemAttachment, MapItemTag, PinLink } from "./types"
import { useDismissKey } from "./useDismissKey"

const COPIED_FEEDBACK_MS = 1500
// collapsed shows the essentials without covering the map entirely; expanded is a drag/tap away
const DOCKED_COLLAPSED_HEIGHT = "60vh"
const DOCKED_EXPANDED_HEIGHT = "92vh"
const DRAG_TOGGLE_THRESHOLD_PX = 60
const DRAG_DISMISS_THRESHOLD_PX = 100

// the side panel's width when it docks to the right edge. Shared because the bottom filter bar
// has to shrink out from under it — a bar that keeps centering on the whole shell ends up with
// half of itself, and one of its fuser patches, hidden behind the panel
export const UNDOCKED_PANEL_WIDTH = "20rem"

export function MapDetailPanel({
  item,
  onClose,
  docked,
}: {
  item: MapItem
  onClose: () => void
  // narrow layouts have no room for a side panel, so it becomes a bottom sheet instead
  docked?: boolean
}) {
  const hero = item.attachments.find((attachment) =>
    isImageMimeType(attachment.mimeType),
  )
  // both fully specify x/y/opacity, even though only one axis actually differs between docked
  // and undocked — deep-linking straight to a pin mounts this before useAvailableSpace's real
  // measurement lands, so `docked` (and this shape) can flip between mount and the next render.
  // motion only ever applies `initial` once and, for any key `animate` doesn't mention, leaves it
  // exactly where it was — a partial restingAt left `y` stuck at its docked-mount value forever
  // once `docked` flipped to false, opacity animating in fine while the panel sat 100% off-screen
  const enterFrom = docked
    ? { x: 0, y: "100%", opacity: 1 }
    : { x: 24, y: 0, opacity: 0 }
  const restingAt = { x: 0, y: 0, opacity: 1 }
  const [openAttachmentIndex, setOpenAttachmentIndex] = useState<number | null>(
    null,
  )
  const [contributeOpen, setContributeOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  useDismissKey(onClose)

  // dragging the handle up/down resizes the sheet; dragging it well past collapsed dismisses,
  // matching the swipe-to-dismiss threshold pattern AttachmentCarousel uses for its own drag gesture
  function handleGrabberDragEnd(_: unknown, info: PanInfo) {
    if (!expanded && info.offset.y > DRAG_DISMISS_THRESHOLD_PX) {
      onClose()
      return
    }
    if (info.offset.y < -DRAG_TOGGLE_THRESHOLD_PX) setExpanded(true)
    else if (info.offset.y > DRAG_TOGGLE_THRESHOLD_PX) setExpanded(false)
  }

  return (
    <motion.div
      key={item.id}
      initial={enterFrom}
      animate={restingAt}
      exit={enterFrom}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      style={docked ? undefined : { width: UNDOCKED_PANEL_WIDTH }}
      className={cn(
        // will-change-transform keeps this panel promoted to its own GPU compositing layer at
        // all times, not just mid-animation — on some Android Chrome builds a layer that gets
        // demoted once the spring settles can briefly paint behind the map's own (always-layered,
        // transform-panned) pins until the next repaint, which read as pins floating on top of the
        // panel until scrolling/panning forced a fresh composite
        "absolute z-20 text-base will-change-transform",
        // no height cap here on purpose — the scrollable box below owns its own height in
        // viewport units, since a percentage cap on this auto-height wrapper wouldn't resolve
        docked ? "inset-x-0 bottom-0" : "inset-y-0 right-0",
      )}
    >
      {/* patches on the outside of the panel's one open edge — the left edge undocked, the top
          edge docked — so it flows into the map rather than cutting a hard corner into it. They
          live outside the scrolling box because that box clips anything hanging past its edges */}
      {docked ? (
        <>
          <SquircleFuser
            corner="bottom-left"
            className={cn(
              "absolute bottom-full left-0",
              fuserOverlapClass("bottom-full left-0"),
            )}
          />
          <SquircleFuser
            corner="bottom-right"
            className={cn(
              "absolute right-0 bottom-full",
              fuserOverlapClass("right-0 bottom-full"),
            )}
          />
        </>
      ) : (
        <>
          <SquircleFuser
            corner="top-right"
            className={cn(
              "absolute top-0 right-full",
              fuserOverlapClass("top-0 right-full"),
            )}
          />
          <SquircleFuser
            corner="bottom-right"
            className={cn(
              "absolute right-full bottom-0",
              fuserOverlapClass("right-full bottom-0"),
            )}
          />
        </>
      )}

      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <ShareMenu pinId={item.id} pinTitle={item.title} />
        <IconButton
          icon={ICONS.close}
          tone="floating"
          onClick={onClose}
          aria-label="Close"
        />
      </div>

      <motion.div
        animate={{
          maxHeight: docked
            ? expanded
              ? DOCKED_EXPANDED_HEIGHT
              : DOCKED_COLLAPSED_HEIGHT
            : "100%",
        }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      style={docked ? undefined : { width: UNDOCKED_PANEL_WIDTH }}
        className={cn(
          // radius matches the fuser patches' 1em fillet, so their arcs meet — the panel itself
          // stays square on its open edge, same trick both docked and undocked. max-height (not
          // max-h-full) lives on this same element as overflow-y-auto so it actually has something
          // to cap itself against — a percentage cap on the motion.div wrapper above wouldn't
          // resolve, since that wrapper has no explicit height of its own
          "flex flex-col gap-4 overflow-y-auto bg-background p-6 corner-squircle",
          docked
            ? "shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
            : "h-full shadow-[-8px_0_24px_rgba(0,0,0,0.45)]",
        )}
      >
        {docked && (
          <motion.span
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.4}
            onDragEnd={handleGrabberDragEnd}
            onClick={() => setExpanded((current) => !current)}
            aria-label={expanded ? "Collapse" : "Expand"}
            role="button"
            className="mx-auto -mt-2 h-1.5 w-10 shrink-0 cursor-grab touch-none rounded-full bg-foreground/25 active:cursor-grabbing"
          />
        )}

        {hero ? (
          <HeroHeading
            title={item.title}
            aliases={item.aliases}
            attachment={hero}
            {...{ docked }}
            onOpen={() => setOpenAttachmentIndex(0)}
          />
        ) : (
          <PlainHeading title={item.title} aliases={item.aliases} />
        )}

        <TagBadge tag={item.tag} />

        {item.description && (
          <p className="text-sm whitespace-pre-wrap opacity-90">
            {item.description}
          </p>
        )}

        <ContactInfo {...{ item }} />

        <CoordinatesLine latitude={item.latitude} longitude={item.longitude} />

        <AttachmentStrip
          attachments={item.attachments}
          onOpen={setOpenAttachmentIndex}
        />

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            Last updated
            <DateCell date={item.updatedAt} />
          </div>
          <MapsMenuButton {...{ item }} />
          <Popover open={contributeOpen} onOpenChange={setContributeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full cursor-pointer rounded-full corner-squircle"
              >
                <Icon icon={ICONS.contributeMenu} />
                Contribute
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              className="flex max-h-[60vh] w-80 flex-col gap-2 overflow-y-auto"
            >
              <ContributeMenu
                pin={{ id: item.id, title: item.title }}
                onClose={() => setContributeOpen(false)}
              />
            </PopoverContent>
          </Popover>
        </div>
      </motion.div>

      {openAttachmentIndex !== null && (
        <AttachmentCarousel
          attachments={item.attachments}
          startIndex={openAttachmentIndex}
          onClose={() => setOpenAttachmentIndex(null)}
        />
      )}


    </motion.div>
  )
}

type Heading = { title: string; aliases: string[] }

function AliasLine({
  aliases,
  className,
}: {
  aliases: string[]
  className?: string
}) {
  if (aliases.length === 0) return null

  return (
    <span className={cn("text-xs font-light", className)}>
      i.e {aliases.join(", ")}
    </span>
  )
}

// when there's a photo, the title sits on top of it behind a scrim instead of above it
function HeroHeading({
  title,
  aliases,
  attachment,
  docked,
  onOpen,
}: Heading & {
  attachment: MapItemAttachment
  docked?: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View photo"
      className={cn(
        "relative -mt-6 h-40 shrink-0 overflow-hidden corner-squircle text-left",
        docked
          ? "-mx-6"
          : // left edge is the panel's open, fused-into-the-map side; right edge sits on the
            // frame's own rounded corner — both need to bleed past the panel's own p-6, or the
            // padding leaves a gap of bare panel bg between the photo and that corner
            "-mx-6 rounded-tl-[1em] sm:rounded-tr-[3rem]",
      )}
    >
      <Image
        src={attachment.url}
        alt=""
        fill
        sizes="320px"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4 text-white">
        <span className="text-2xl leading-6 font-bold text-shadow-md text-shadow-black/60">
          {title}
        </span>
        <AliasLine
          {...{ aliases }}
          className="opacity-90 text-shadow-sm text-shadow-black/60"
        />
      </div>
    </button>
  )
}

function PlainHeading({ title, aliases }: Heading) {
  return (
    <div className="flex flex-col gap-1 pr-8">
      <span className="text-2xl leading-6 font-bold">{title}</span>
      <AliasLine {...{ aliases }} className="opacity-70" />
    </div>
  )
}

function TagBadge({ tag }: { tag: MapItemTag }) {
  return (
    <div className="flex">
      <span
        className={tagChipClassName(false)}
        style={tagColorStyle(tag.color, false)}
      >
        <TagChipIcon tag={tag} active={false} />
        {tag.label}
      </span>
    </div>
  )
}

function HoursLine({
  hours,
  ramadanHours,
}: {
  hours: string
  ramadanHours: string | null
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon icon={ICONS.clock} className="shrink-0" />
      {hours}
      {ramadanHours && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Ramadan hours"
              className="rounded-full corner-squircle p-1 opacity-70 transition-opacity hover:bg-foreground/10 hover:opacity-100"
            >
              <Icon icon={ICONS.ramadan} className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto">
            <span className="flex items-center gap-1.5 text-sm">
              <Icon icon={ICONS.ramadan} className="size-3.5 shrink-0" />
              Ramadan hours: {ramadanHours}
            </span>
          </PopoverContent>
        </Popover>
      )}
    </span>
  )
}

function LinkRow({ link }: { link: PinLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 hover:underline"
    >
      <Icon icon={ICONS.link} className="shrink-0" />
      <span className="truncate">{link.label}</span>
      <Icon
        icon={ICONS.externalLink}
        className="shrink-0 opacity-70"
        style={{ width: "0.7rem", height: "0.7rem" }}
      />
    </a>
  )
}

function ContactInfo({ item }: { item: MapItem }) {
  if (!item.hours && !item.phone && !item.email && item.links.length === 0)
    return null

  return (
    <div className="flex flex-col gap-1.5 text-sm opacity-90">
      {item.hours && (
        <HoursLine hours={item.hours} ramadanHours={item.ramadanHours} />
      )}
      {item.phone && (
        <a
          href={`tel:${item.phone.replace(/\s+/g, "")}`}
          className="flex items-center gap-2 hover:underline"
        >
          <Icon icon={ICONS.phone} className="shrink-0" />
          {item.phone}
        </a>
      )}
      {item.email && (
        <a
          href={`mailto:${item.email}`}
          className="flex items-center gap-2 hover:underline"
        >
          <Icon icon={ICONS.email} className="shrink-0" />
          {item.email}
        </a>
      )}
      {item.links.map((link) => (
        <LinkRow key={link.url} {...{ link }} />
      ))}
    </div>
  )
}

// no single link opens "the" maps app on every platform — geo: only resolves on Android, and
// navigator.userAgent can guess Apple vs Google but can't know someone prefers Waze. so this
// is a menu, decided at click time (client-only, no hydration risk) rather than one guessed link
function MapsMenuButton({ item }: { item: MapItem }) {
  const { copied, copy } = useCopyFeedback(COPIED_FEEDBACK_MS)
  const coordinates = `${item.latitude},${item.longitude}`

  // an admin-curated place link, when set, replaces the generic coordinate search so the
  // Google Maps option can carry reviews/photos instead of just dropping a bare pin
  const googleMapsUrl =
    item.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${coordinates}`
  // documented apple maps url scheme: ll + q together drops a pin at the exact coordinate,
  // labeled with q — it does not search for q, so it won't snap to a nearby POI
  const appleMapsUrl = `https://maps.apple.com/?ll=${coordinates}&q=${encodeURIComponent(item.title)}`
  const wazeUrl = `https://waze.com/ul?ll=${coordinates}&navigate=yes`

  function openMapsUrl(url: string) {
    triggerHaptic()
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function copyCoordinates() {
    triggerHaptic()
    copy(formatCoordinates(item))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-full corner-squircle bg-foreground/8 px-3 py-2 text-sm font-medium transition-colors hover:bg-foreground/15"
        >
          <Icon icon={ICONS.openExternalMap} />
          Open in Maps
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-[--radix-dropdown-menu-trigger-width] min-w-48"
      >
        <DropdownMenuItem onSelect={() => openMapsUrl(googleMapsUrl)}>
          <Icon icon={ICONS.openExternalMap} />
          Google Maps
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openMapsUrl(appleMapsUrl)}>
          <Icon icon={ICONS.openExternalMap} />
          Apple Maps
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openMapsUrl(wazeUrl)}>
          <Icon icon={ICONS.openExternalMap} />
          Waze
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyCoordinates}>
          <Icon icon={copied ? ICONS.copied : ICONS.copy} />
          {copied ? "Copied!" : "Copy coordinates"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CoordinatesLine({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const coordinates = formatCoordinates({ latitude, longitude })
  const { copied, copy } = useCopyFeedback(COPIED_FEEDBACK_MS)

  return (
    <span className="group flex items-center gap-2 text-sm opacity-70">
      <Icon icon={ICONS.target} className="shrink-0" />
      {coordinates}
      <button
        type="button"
        onClick={() => copy(coordinates)}
        aria-label="Copy coordinates"
        className="rounded-full corner-squircle p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-foreground/10 focus-visible:opacity-100"
      >
        <Icon icon={copied ? ICONS.copied : ICONS.copy} className="size-3.5" />
      </button>
    </span>
  )
}
