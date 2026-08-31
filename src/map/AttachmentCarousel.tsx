"use client"

import { AnimatePresence, motion } from "motion/react"
import Image from "next/image"
import { useState } from "react"
import { Icon } from "@/components/Icon"
import { IconButton } from "@/components/IconButton"
import { DateCell } from "@/components/table/CustomTableCell"
import { ICONS } from "@/icons"
import { Dialog, DialogContent, DialogTitle } from "@/shadcn/ui/dialog"
import { cn } from "@/shadcn/utils"
import { iconForMimeType, isImageMimeType, isVideoMimeType } from "@/utils/mimeType"
import { HIDE_SCROLLBAR } from "@/utils/styles"
import type { MapItemAttachment } from "./types"

const SWIPE_THRESHOLD_PX = 80

function StripTile({ attachment }: { attachment: MapItemAttachment }) {
  if (isImageMimeType(attachment.mimeType)) {
    return <Image src={attachment.url} alt="" fill sizes="64px" className="object-cover" />
  }

  if (isVideoMimeType(attachment.mimeType)) {
    return (
      <>
        <video src={attachment.url} muted playsInline preload="metadata" className="size-full object-cover" />
        <Icon icon={ICONS.video} className="absolute inset-0 m-auto size-5 text-white drop-shadow-md" />
      </>
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-foreground/10">
      <Icon icon={iconForMimeType(attachment.mimeType)} className="size-6" />
    </div>
  )
}

export function AttachmentStrip({
  attachments,
  onOpen,
  onAdd,
}: {
  attachments: MapItemAttachment[]
  onOpen: (index: number) => void
  onAdd: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium opacity-60">
        <Icon icon={ICONS.files} className="size-3.5" />
        Files
      </span>

      {attachments.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl corner-squircle border border-dashed border-border py-6 text-muted-foreground transition-colors hover:bg-foreground/10"
        >
          <Icon icon={ICONS.contribute} className="size-6" />
          <span className="text-sm">Contribute a media file</span>
        </button>
      ) : (
        <div className={cn("flex gap-2 overflow-x-auto py-1", HIDE_SCROLLBAR)}>
          {attachments.map((attachment, index) => (
            <button
              key={attachment.id}
              type="button"
              onClick={() => onOpen(index)}
              className="relative size-16 shrink-0 overflow-hidden rounded-xl corner-squircle ring-1 ring-border transition-transform hover:scale-105"
            >
              <StripTile {...{ attachment }} />
            </button>
          ))}
          {/* not ICONS.add — this doesn't add a file directly like the admin gallery does, it
              opens ContributeDialog, which sends the file for review. FileAddIcon (the same glyph
              the standalone contribute button elsewhere uses) reads as "suggest a file" instead */}
          <button
            type="button"
            onClick={onAdd}
            aria-label="Contribute a file"
            className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl corner-squircle border border-dashed border-border text-muted-foreground transition-colors hover:bg-foreground/10"
          >
            <Icon icon={ICONS.contribute} className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}

function CarouselAttachment({
  attachment,
  draggable,
  onSwipe,
}: {
  attachment: MapItemAttachment
  draggable: boolean
  onSwipe: (by: 1 | -1) => void
}) {
  if (isVideoMimeType(attachment.mimeType)) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: no caption track exists for a visitor-submitted video
      <motion.video
        src={attachment.url}
        controls
        playsInline
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="max-h-full max-w-full"
      />
    )
  }

  if (!isImageMimeType(attachment.mimeType)) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col items-center gap-3 px-6 text-white"
      >
        <Icon icon={iconForMimeType(attachment.mimeType)} className="size-16" />
        <span className="max-w-xs truncate text-center text-sm">{attachment.fileName ?? "File"}</span>
        <a
          href={attachment.url}
          download={attachment.fileName ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full corner-squircle bg-white/10 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/20"
        >
          <Icon icon={ICONS.upload} className="rotate-180" />
          Download
        </a>
      </motion.div>
    )
  }

  return (
    // biome-ignore lint/performance/noImgElement: needs motion's drag gesture, which next/image doesn't compose with
    <motion.img
      src={attachment.url}
      alt=""
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      drag={draggable ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x < -SWIPE_THRESHOLD_PX) onSwipe(1)
        else if (info.offset.x > SWIPE_THRESHOLD_PX) onSwipe(-1)
      }}
      className="max-h-full max-w-full object-contain"
    />
  )
}

export function AttachmentCarousel({
  attachments,
  startIndex,
  onClose,
}: {
  attachments: MapItemAttachment[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const hasMultiple = attachments.length > 1
  const { caption, postedAt } = attachments[index]
  const step = (by: number) => setIndex((i) => (i + by + attachments.length) % attachments.length)

  const stepButtons = [
    { icon: ICONS.carouselPrev, by: -1, label: "Previous photo", side: "left-4" },
    { icon: ICONS.carouselNext, by: 1, label: "Next photo", side: "right-4" },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[90vh] w-[95vw] max-w-4xl flex-col overflow-hidden rounded-[2rem] corner-squircle border-none bg-black/95 p-0 sm:max-w-4xl"
      >
        <DialogTitle className="sr-only">Photo viewer</DialogTitle>
        <IconButton
          icon={ICONS.close}
          tone="overlay"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10"
        />

        {hasMultiple &&
          stepButtons.map(({ icon, by, label, side }) => (
            <IconButton
              key={label}
              tone="overlay"
              size="lg"
              onClick={() => step(by)}
              aria-label={label}
              className={cn("absolute z-10 top-1/2 -translate-y-1/2", side)}
              {...{ icon }}
            />
          ))}

        <div className="relative flex flex-1 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <CarouselAttachment
              key={attachments[index].id}
              attachment={attachments[index]}
              draggable={hasMultiple}
              onSwipe={(by) => step(by)}
            />
          </AnimatePresence>

          {hasMultiple && (
            <div className="absolute bottom-4 flex gap-1.5">
              {attachments.map((attachment, i) => (
                <span
                  key={attachment.id}
                  className={cn("size-1.5 rounded-full", i === index ? "bg-white" : "bg-white/30")}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 px-6 pb-5 text-center text-sm text-white/60">
          {caption && (
            <p className="flex items-center justify-center gap-1.5">
              <Icon icon={ICONS.caption} className="size-4 shrink-0" />
              {caption}
            </p>
          )}
          <DateCell date={postedAt} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
