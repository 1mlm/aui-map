"use client"

import { motion } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { SquircleFuser } from "@/components/SquircleFuser"
import { ICONS } from "@/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shadcn/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover"
import { cn } from "@/shadcn/utils"
import { triggerHaptic } from "@/utils/haptics"
import { isImageMimeType } from "@/utils/mimeType"
import { AttachmentCarousel, AttachmentStrip } from "./AttachmentCarousel"
import { ContributeDialog } from "./ContributeDialog"
import { tagChipClassName, TagChipIcon } from "./MapTagFilter"
import { tagColorStyle } from "./tagColor"
import type { MapItem, MapItemAttachment, MapItemTag, PinLink } from "./types"

const COPIED_FEEDBACK_MS = 1500

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
  const hero = item.attachments.find((attachment) => isImageMimeType(attachment.mimeType))
  const enterFrom = docked ? { y: "100%" } : { x: 24, opacity: 0 }
  const restingAt = docked ? { y: 0 } : { x: 0, opacity: 1 }
  const [openAttachmentIndex, setOpenAttachmentIndex] = useState<number | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)

  return (
    <motion.div
      key={item.id}
      initial={enterFrom}
      animate={restingAt}
      exit={enterFrom}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className={cn(
        "absolute z-10 text-base",
        docked ? "inset-x-0 bottom-0 max-h-[75%]" : "inset-y-0 right-0 w-80",
      )}
    >
      {/* patches on the outside of the panel's one open edge — the left edge undocked, the top
          edge docked — so it flows into the map rather than cutting a hard corner into it. They
          live outside the scrolling box because that box clips anything hanging past its edges */}
      {docked ? (
        <>
          <SquircleFuser corner="bottom-left" className="absolute bottom-full left-0" />
          <SquircleFuser corner="bottom-right" className="absolute right-0 bottom-full" />
        </>
      ) : (
        <>
          <SquircleFuser corner="top-right" className="absolute top-0 right-full" />
          <SquircleFuser corner="bottom-right" className="absolute right-full bottom-0" />
        </>
      )}

      <IconButton
        icon={ICONS.close}
        // the button sits over the hero photo as often as over the panel itself, so it carries its
        // own dark backdrop rather than tinting with whatever is behind it
        tone="floating"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 z-10"
      />

      <div
        className={cn(
          // radius matches the fuser patches' 1em fillet, so their arcs meet — the panel itself
          // stays square on its open edge, same trick both docked and undocked
          "flex max-h-full flex-col gap-4 overflow-y-auto bg-background p-6 corner-squircle",
          docked
            ? "shadow-[0_-8px_24px_rgba(0,0,0,0.45)]"
            : "h-full shadow-[-8px_0_24px_rgba(0,0,0,0.45)]",
        )}
      >
        {docked && (
          <span className="mx-auto -mt-2 h-1 w-10 shrink-0 rounded-full bg-foreground/25" />
        )}

        {hero ? (
          <HeroHeading
            title={item.title}
            aliases={item.aliases}
            attachment={hero}
            docked={docked}
            onOpen={() => setOpenAttachmentIndex(0)}
          />
        ) : (
          <PlainHeading title={item.title} aliases={item.aliases} />
        )}

        <TagBadge tag={item.tag} />

        {item.description && (
          <p className="text-sm whitespace-pre-wrap opacity-90">{item.description}</p>
        )}

        <ContactInfo {...{ item }} />

        <CoordinatesLine latitude={item.latitude} longitude={item.longitude} />

        <AttachmentStrip
          attachments={item.attachments}
          onOpen={setOpenAttachmentIndex}
          onAdd={() => setContributeOpen(true)}
        />

        <div className="mt-auto">
          <MapsMenuButton {...{ item }} />
        </div>
      </div>

      {openAttachmentIndex !== null && (
        <AttachmentCarousel
          attachments={item.attachments}
          startIndex={openAttachmentIndex}
          onClose={() => setOpenAttachmentIndex(null)}
        />
      )}

      <ContributeDialog pinId={item.id} pinTitle={item.title} open={contributeOpen} onOpenChange={setContributeOpen} />
    </motion.div>
  )
}

type Heading = { title: string; aliases: string[] }

function AliasLine({ aliases, className }: { aliases: string[]; className?: string }) {
  if (aliases.length === 0) return null

  return <span className={cn("text-xs font-light", className)}>i.e {aliases.join(", ")}</span>
}

// when there's a photo, the title sits on top of it behind a scrim instead of above it
function HeroHeading({
  title,
  aliases,
  attachment,
  docked,
  onOpen,
}: Heading & { attachment: MapItemAttachment; docked?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="View photo"
      className={cn(
        "relative -mt-6 h-40 shrink-0 overflow-hidden corner-squircle text-left",
        docked
          ? "-mx-6"
          : // only the left edge is the panel's open, fused-into-the-map side — the top-right
            // corner sits on the frame's own rounded corner, so it needs the same radius or the
            // frame's overflow-clip notches a chunk out of the photo there
            "-ml-6 rounded-tl-[1em] sm:rounded-tr-[3rem]",
      )}
    >
      <Image src={attachment.url} alt="" fill sizes="320px" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4 text-white">
        <span className="text-2xl leading-6 font-bold text-shadow-md text-shadow-black/60">
          {title}
        </span>
        <AliasLine {...{ aliases }} className="opacity-90 text-shadow-sm text-shadow-black/60" />
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
      <span className={tagChipClassName(false)} style={tagColorStyle(tag.color, false)}>
        <TagChipIcon tag={tag} active={false} />
        {tag.label}
      </span>
    </div>
  )
}

function HoursLine({ hours, ramadanHours }: { hours: string; ramadanHours: string | null }) {
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
      <Icon icon={ICONS.externalLink} className="shrink-0 opacity-70" style={{ width: "0.7rem", height: "0.7rem" }} />
    </a>
  )
}

function ContactInfo({ item }: { item: MapItem }) {
  if (!item.hours && !item.phone && !item.email && item.links.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 text-sm opacity-90">
      {item.hours && <HoursLine hours={item.hours} ramadanHours={item.ramadanHours} />}
      {item.phone && (
        <a href={`tel:${item.phone.replace(/\s+/g, "")}`} className="flex items-center gap-2 hover:underline">
          <Icon icon={ICONS.phone} className="shrink-0" />
          {item.phone}
        </a>
      )}
      {item.email && (
        <a href={`mailto:${item.email}`} className="flex items-center gap-2 hover:underline">
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
  const [copied, setCopied] = useState(false)
  const coordinates = `${item.latitude},${item.longitude}`

  // an admin-curated place link, when set, replaces the generic coordinate search so the
  // Google Maps option can carry reviews/photos instead of just dropping a bare pin
  const googleMapsUrl = item.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${coordinates}`
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
    navigator.clipboard.writeText(`${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
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
      <DropdownMenuContent align="center" className="w-[--radix-dropdown-menu-trigger-width] min-w-48">
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

function CoordinatesLine({ latitude, longitude }: { latitude: number; longitude: number }) {
  const coordinates = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  const [copied, setCopied] = useState(false)

  const copyCoordinates = () => {
    navigator.clipboard.writeText(coordinates)
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  return (
    <span className="group flex items-center gap-2 text-sm opacity-70">
      <Icon icon={ICONS.target} className="shrink-0" />
      {coordinates}
      <button
        type="button"
        onClick={copyCoordinates}
        aria-label="Copy coordinates"
        className="rounded-full corner-squircle p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-foreground/10 focus-visible:opacity-100"
      >
        <Icon icon={copied ? ICONS.copied : ICONS.copy} className="size-3.5" />
      </button>
    </span>
  )
}
